import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { aiUsageTable } from "../../apps/api/src/database/schema";
import { createApp } from "../../apps/api/src/index";
import { model, reply } from "./helpers/agent-model";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";

// Every scripted reply reports 30 prompt and 20 completion tokens.
vi.mock("../../apps/api/src/agent/openrouter", async (original) => ({
  ...(await original<object>()),
  createCompletion: vi.fn(
    async (
      messages: never,
      _tools: unknown,
      _onText: unknown,
      onUsage?: (usage: object) => void,
    ) => {
      model.seen.push(messages);
      const next = model.queue.shift();
      if (!next) throw new Error("no scripted reply");
      onUsage?.({
        model: "test-model",
        promptTokens: 30,
        completionTokens: 20,
        cost: null,
      });
      return next;
    },
  ),
}));

type User = typeof schema.userTable.$inferSelect;

const PARAGRAPH =
  "We met on Tuesday to talk about the launch plan, and after a long discussion that went over every risk we could think of, we agreed that the launch should move to the second week of March.";

describe("API integration: AI writing help", () => {
  const { app } = createApp();
  let owner: User;
  let ws: string;

  beforeEach(async () => {
    await resetTestDatabase();
    process.env.OPENROUTER_API_KEY = "test-key";
    model.queue.length = 0;
    model.seen.length = 0;
    const member = await createWorkspaceMember({ role: "owner" });
    owner = member.user;
    ws = member.workspace.id;
  });

  const rewrite = (user: User, body: object, workspaceId = ws) => {
    mockAuthenticatedSession(user);
    return app.request(`/api/agent/workspace/${workspaceId}/writing`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  };

  it("returns the shortened text without saving anything, and counts it as writing help", async () => {
    model.queue.push(reply("The launch moves to the second week of March."));
    const res = await rewrite(owner, { action: "shorten", text: PARAGRAPH });
    expect(res.status, await res.clone().text()).toBe(200);
    expect(await res.json()).toEqual({
      text: "The launch moves to the second week of March.",
    });
    // The selection went to the model as data, with the action asked for.
    const sent = JSON.stringify(model.seen[0]);
    expect(sent).toContain(PARAGRAPH);
    expect(sent.toLowerCase()).toContain("shorter");

    const usage = await db.select().from(aiUsageTable);
    expect(usage).toMatchObject([
      { purpose: "writing", userId: owner.id, workspaceId: ws },
    ]);
    mockAuthenticatedSession(owner);
    const report = await app.request(`/api/agent/workspace/${ws}/usage`);
    const body = await report.json();
    expect(body.byFeature).toMatchObject([{ feature: "writing", tokens: 50 }]);
  });

  it("drops a code fence or quotes the model wraps the text in", async () => {
    model.queue.push(reply('```\n"Launch moves to March."\n```'));
    const res = await rewrite(owner, { action: "shorten", text: PARAGRAPH });
    expect(await res.json()).toEqual({ text: "Launch moves to March." });
  });

  it("refuses an unknown action, empty text and text that is too long, before asking the model", async () => {
    expect((await rewrite(owner, { action: "delete", text: "x" })).status).toBe(
      400,
    );
    expect(
      (await rewrite(owner, { action: "shorten", text: " " })).status,
    ).toBe(400);
    expect(
      (await rewrite(owner, { action: "shorten", text: "a".repeat(8_001) }))
        .status,
    ).toBe(400);
    expect(model.seen).toHaveLength(0);
  });

  it("is only for members of the workspace", async () => {
    const stranger = await createWorkspaceMember({ role: "owner" });
    const res = await rewrite(stranger.user, {
      action: "shorten",
      text: PARAGRAPH,
    });
    expect([403, 404]).toContain(res.status);
    expect(model.seen).toHaveLength(0);
  });

  it("is open to any member who can read, since it only changes their own selection", async () => {
    const viewer = await addWorkspaceMember(ws, "viewer");
    model.queue.push(reply("Shorter."));
    const res = await rewrite(viewer, { action: "shorten", text: PARAGRAPH });
    expect(res.status).toBe(200);
  });

  it("is off without a model key", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const res = await rewrite(owner, { action: "shorten", text: PARAGRAPH });
    expect(res.status).toBe(404);
  });
});
