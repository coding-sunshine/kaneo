import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { callTool, model, reply } from "./helpers/agent-model";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

vi.mock("../../apps/api/src/agent/openrouter", async (original) => ({
  ...(await original<object>()),
  createCompletion: vi.fn(async (messages: never) => {
    model.seen.push(messages);
    const next = model.queue.shift();
    if (!next) throw new Error("no scripted reply");
    return next;
  }),
}));

const post = (body: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

async function addMember(workspaceId: string, role: string) {
  const other = await createWorkspaceMember();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: other.user.id,
    role,
    joinedAt: new Date(),
  });
  return other.user;
}

describe("API integration: agent", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    process.env.OPENROUTER_API_KEY = "test-key";
    model.queue.length = 0;
    model.seen.length = 0;
  });

  it("is hidden without an OpenRouter key", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();
    delete process.env.OPENROUTER_API_KEY;

    const res = await app.request(
      `/api/agent/workspace/${owner.workspace.id}/chats`,
    );
    expect(res.status).toBe(404);
    const config = await (await app.request("/api/config")).json();
    expect(config.hasAgent).toBe(false);
  });

  it("runs read tools as the caller, scoped to the workspace", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const mine = await createProjectFixture({
      workspaceId: owner.workspace.id,
      name: "Visible project",
    });
    const foreign = await createWorkspaceMember({ role: "owner" });
    await createProjectFixture({
      workspaceId: foreign.workspace.id,
      name: "Secret project",
    });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();
    const ws = owner.workspace.id;

    model.queue.push(
      callTool("list_projects", { workspaceId: ws }),
      callTool("list_projects", { workspaceId: foreign.workspace.id }),
      reply("done"),
    );
    const res = await app.request(
      `/api/agent/workspace/${ws}/messages`,
      post({ message: "what projects exist?" }),
    );
    expect(res.status).toBe(200);
    const { chatId, messages } = await res.json();
    const results = messages
      .filter((m: { role: string }) => m.role === "tool")
      .map((m: { content: string }) => m.content);
    expect(results[0]).toContain("Visible project");
    expect(results[0]).toContain(mine.project.id);
    expect(results[1]).not.toContain("Secret project");
    expect(results[1]).toContain("error");
    expect(messages.at(-1)).toMatchObject({
      role: "assistant",
      content: "done",
    });
    // The model was told the workspace and given the allowlisted tools only.
    expect(model.seen[0]?.[0]?.content).toContain(ws);

    const saved = await (
      await app.request(`/api/agent/workspace/${ws}/chats/${chatId}`)
    ).json();
    expect(saved.messages).toHaveLength(messages.length);
    const list = await (
      await app.request(`/api/agent/workspace/${ws}/chats`)
    ).json();
    expect(list).toHaveLength(1);
  });

  it("keeps chats private and refuses non-members", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();
    const ws = owner.workspace.id;
    model.queue.push(reply("hi"));
    const { chatId } = await (
      await app.request(
        `/api/agent/workspace/${ws}/messages`,
        post({ message: "hello" }),
      )
    ).json();

    const teammate = await addMember(ws, "member");
    mockAuthenticatedSession(teammate);
    expect(
      (await app.request(`/api/agent/workspace/${ws}/chats/${chatId}`)).status,
    ).toBe(404);

    const stranger = await createWorkspaceMember();
    mockAuthenticatedSession(stranger.user);
    const denied = await app.request(
      `/api/agent/workspace/${ws}/messages`,
      post({ message: "hello" }),
    );
    expect(denied.status).toBeGreaterThanOrEqual(403);
    expect(model.queue).toHaveLength(0);
    expect(model.seen).toHaveLength(1);
  });

  it("streams the reply as server-sent events", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();
    model.queue.push(reply("streamed"));
    const res = await app.request(
      `/api/agent/workspace/${owner.workspace.id}/messages/stream`,
      post({ message: "hi" }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const events = (await res.text())
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => JSON.parse(line.slice(5)));
    expect(events.map((e) => e.type)).toEqual(["chat", "message", "done"]);
    expect(events[1].message).toMatchObject({ content: "streamed" });
  });
});
