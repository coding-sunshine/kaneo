import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { tokensUsedToday } from "../../apps/api/src/agent/usage";
import {
  aiBudgetTable,
  aiUsageTable,
} from "../../apps/api/src/database/schema";
import { createApp } from "../../apps/api/src/index";
import { model, reply } from "./helpers/agent-model";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

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
        cost: 0.001,
      });
      return next;
    },
  ),
}));

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
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

const usageRows = () => db.select().from(aiUsageTable);

describe("API integration: AI usage and budgets", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    process.env.OPENROUTER_API_KEY = "test-key";
    model.queue.length = 0;
    model.seen.length = 0;
  });

  it("lists a workspace's tokens by feature and by day", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();
    const ws = owner.workspace.id;

    model.queue.push(reply("hi"));
    const sent = await app.request(
      `/api/agent/workspace/${ws}/messages`,
      json("POST", { message: "hello" }),
    );
    expect(sent.status).toBe(200);

    const res = await app.request(`/api/agent/workspace/${ws}/usage`);
    expect(res.status).toBe(200);
    const usage = await res.json();
    expect(usage.byFeature).toEqual([
      { feature: "assistant", tokens: 50, cost: 0.001 },
    ]);
    expect(usage.byDay).toEqual([
      { day: new Date().toISOString().slice(0, 10), tokens: 50 },
    ]);
    expect(usage.monthTokens).toBe(50);
    expect(usage.budget).toEqual({
      userDailyTokens: null,
      workspaceMonthlyTokens: null,
    });
    const [row] = await usageRows();
    expect(row).toMatchObject({ workspaceId: ws, userId: owner.user.id });
  });

  it("stops a person at the daily budget without calling the model", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();
    const ws = owner.workspace.id;

    const set = await app.request(
      `/api/agent/workspace/${ws}/budget`,
      json("PUT", { userDailyTokens: 10, workspaceMonthlyTokens: null }),
    );
    expect(set.status).toBe(200);

    model.queue.push(reply("first"), reply("second"));
    const first = await app.request(
      `/api/agent/workspace/${ws}/messages`,
      json("POST", { message: "one" }),
    );
    expect(first.status).toBe(200);
    const second = await app.request(
      `/api/agent/workspace/${ws}/messages`,
      json("POST", { message: "two" }),
    );
    expect(second.status).toBe(429);
    expect((await second.json()).message).toContain("daily AI limit reached");
    expect(model.seen).toHaveLength(1);
    expect(await usageRows()).toHaveLength(1);
    // The refused question opens no chat.
    expect(await db.select().from(schema.agentChatTable)).toHaveLength(1);

    const streamed = await app.request(
      `/api/agent/workspace/${ws}/messages/stream`,
      json("POST", { message: "three" }),
    );
    expect(await streamed.text()).toContain("daily AI limit reached");
    expect(model.seen).toHaveLength(1);
  });

  it("keeps the daily budget per person", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const ws = owner.workspace.id;
    const member = await addMember(ws, "member");
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();
    await app.request(
      `/api/agent/workspace/${ws}/budget`,
      json("PUT", { userDailyTokens: 10, workspaceMonthlyTokens: null }),
    );
    model.queue.push(reply("owner"), reply("member"));
    await app.request(
      `/api/agent/workspace/${ws}/messages`,
      json("POST", { message: "one" }),
    );

    mockAuthenticatedSession(member);
    const res = await app.request(
      `/api/agent/workspace/${ws}/messages`,
      json("POST", { message: "mine" }),
    );
    expect(res.status).toBe(200);
    expect(model.seen).toHaveLength(2);
  });

  it("stops a manual loop run at the workspace's monthly budget", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();
    const ws = owner.workspace.id;
    const created = await app.request(
      "/api/loop",
      json("POST", {
        workspaceId: ws,
        name: "Weekly wrap",
        instructions: "List the projects",
        frequency: "weekly",
      }),
    );
    const loop = await created.json();
    await app.request(
      `/api/agent/workspace/${ws}/budget`,
      json("PUT", { userDailyTokens: null, workspaceMonthlyTokens: 0 }),
    );

    model.queue.push(reply("never"));
    const res = await app.request(
      `/api/loop/workspace/${ws}/${loop.id}/run`,
      json("POST"),
    );
    expect(res.status).toBe(429);
    expect((await res.json()).message).toContain("monthly AI limit reached");
    expect(model.seen).toHaveLength(0);
    expect(await usageRows()).toHaveLength(0);

    const draft = await app.request(
      "/api/loop/draft",
      json("POST", { workspaceId: ws, description: "Weekly summary" }),
    );
    expect(draft.status).toBe(429);
    expect(model.seen).toHaveLength(0);
  });

  it("does not count assistant tokens against the extraction cap", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();
    model.queue.push(reply("hi"));
    await app.request(
      `/api/agent/workspace/${owner.workspace.id}/messages`,
      json("POST", { message: "hello" }),
    );
    expect(await usageRows()).toHaveLength(1);
    expect(await tokensUsedToday(owner.workspace.id)).toBe(0);
  });

  it("stops a chat call once the month's AI spending of every feature reaches 20 USD, until the next month", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();
    const ws = owner.workspace.id;
    // Spent by a call made for a workspace, with no workspace budget set.
    const [spent] = await db
      .insert(aiUsageTable)
      .values({
        purpose: "loop",
        workspaceId: ws,
        userId: owner.user.id,
        model: "test-model",
        promptTokens: 1,
        completionTokens: 1,
        cost: 20.5,
      })
      .returning();
    const send = () =>
      app.request(
        `/api/agent/workspace/${ws}/messages`,
        json("POST", { message: "hello" }),
      );

    const refused = await send();
    expect(refused.status).toBe(429);
    expect((await refused.json()).message).toContain(
      "monthly AI spending limit reached",
    );
    expect(model.seen).toHaveLength(0);

    // The spend now falls in the month before: this month starts from nothing.
    const now = new Date();
    await db
      .update(aiUsageTable)
      .set({
        createdAt: new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 12),
        ),
      })
      .where(eq(aiUsageTable.id, spent!.id));
    model.queue.push(reply("hi"));
    expect((await send()).status).toBe(200);
    expect(model.seen).toHaveLength(1);
  });

  it("lets only workspace admins see usage and set budgets", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const ws = owner.workspace.id;
    const member = await addMember(ws, "member");
    const stranger = await createWorkspaceMember({ role: "owner" });
    const { app } = createApp();

    // A member lacks the permission; a stranger cannot even see the workspace.
    for (const user of [member, stranger.user]) {
      mockAuthenticatedSession(user);
      const usage = await app.request(`/api/agent/workspace/${ws}/usage`);
      expect([403, 404]).toContain(usage.status);
      const budget = await app.request(
        `/api/agent/workspace/${ws}/budget`,
        json("PUT", { userDailyTokens: 1, workspaceMonthlyTokens: 1 }),
      );
      expect([403, 404]).toContain(budget.status);
      if (user === member) expect(budget.status).toBe(403);
    }
    expect(await db.select().from(aiBudgetTable)).toHaveLength(0);
  });

  it("shows one workspace's usage only to that workspace", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const other = await createWorkspaceMember({ role: "owner" });
    const { app } = createApp();
    mockAuthenticatedSession(owner.user);
    model.queue.push(reply("hi"));
    await app.request(
      `/api/agent/workspace/${owner.workspace.id}/messages`,
      json("POST", { message: "hello" }),
    );

    mockAuthenticatedSession(other.user);
    const usage = await (
      await app.request(`/api/agent/workspace/${other.workspace.id}/usage`)
    ).json();
    expect(usage.byFeature).toEqual([]);
    expect(usage.byDay).toEqual([]);
    expect(usage.monthTokens).toBe(0);
  });

  it("sums more tokens than a 32-bit integer holds", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();
    const ws = owner.workspace.id;
    const big = {
      purpose: "assistant",
      model: "test-model",
      workspaceId: ws,
      userId: owner.user.id,
      promptTokens: 2_000_000_000,
      completionTokens: 0,
    };
    await db.insert(aiUsageTable).values([big, big]);

    const usage = await (
      await app.request(`/api/agent/workspace/${ws}/usage`)
    ).json();
    expect(usage.monthTokens).toBe(4_000_000_000);
    expect(usage.byFeature[0].tokens).toBe(4_000_000_000);
  });

  it("keeps usage rows of a person or workspace no longer present", async () => {
    await db.insert(aiUsageTable).values({
      purpose: "assistant",
      model: "test-model",
      workspaceId: "gone-workspace",
      userId: "gone-user",
      promptTokens: 1,
      completionTokens: 1,
    });
    expect(await usageRows()).toHaveLength(1);
  });

  it("rejects negative budgets", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();
    const res = await app.request(
      `/api/agent/workspace/${owner.workspace.id}/budget`,
      json("PUT", { userDailyTokens: -1, workspaceMonthlyTokens: null }),
    );
    expect(res.status).toBe(400);
  });

  it("hides usage and budgets without an OpenRouter key", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();
    delete process.env.OPENROUTER_API_KEY;
    const ws = owner.workspace.id;
    expect((await app.request(`/api/agent/workspace/${ws}/usage`)).status).toBe(
      404,
    );
    expect(
      (
        await app.request(
          `/api/agent/workspace/${ws}/budget`,
          json("PUT", { userDailyTokens: 1, workspaceMonthlyTokens: 1 }),
        )
      ).status,
    ).toBe(404);
  });
});
