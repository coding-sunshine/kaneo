import { eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import {
  chatChannelMemberTable,
  chatChannelTable,
  chatMessageTable,
  aiDestinationChangeTable,
  documentTable,
  semanticChunkTable,
} from "../../apps/api/src/database/schema";
import { createApp } from "../../apps/api/src/index";
import { setBudget } from "../../apps/api/src/agent/budget";
import { recordUsage } from "../../apps/api/src/agent/usage";
import { indexSemanticChunks } from "../../apps/api/src/semantic-search/index-chunks";
import { model, reply } from "./helpers/agent-model";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";

vi.mock("../../apps/api/src/agent/openrouter", async (original) => ({
  ...(await original<object>()),
  createCompletion: vi.fn(async (messages: never) => {
    model.seen.push(messages);
    const next = model.queue.shift();
    if (!next) throw new Error("no scripted reply");
    return next;
  }),
}));

// A fake of the embedding service: words map to shared concepts, so texts
// with different words but the same meaning land close together.
const CONCEPTS: Record<string, string[]> = {
  choose: [
    "pick",
    "picked",
    "chose",
    "chosen",
    "choose",
    "decision",
    "selected",
    "won",
  ],
  vendor: ["vendor", "supplier", "northwind", "contoso"],
  support: ["support", "answers", "help"],
  lunch: ["lunch", "pizza", "friday"],
  deploy: ["deploy", "release", "ship"],
};
const DIMENSIONS = Object.keys(CONCEPTS);
function fakeEmbedding(text: string) {
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  return DIMENSIONS.map(
    (dim) => words.filter((word) => CONCEPTS[dim]?.includes(word)).length,
  );
}
const embeddingCalls: string[][] = [];
const realFetch = globalThis.fetch;

type User = typeof schema.userTable.$inferSelect;
const { app } = createApp();

const turn = (user: User, ws: string, enabled: boolean) => {
  mockAuthenticatedSession(user);
  return app.request(`/api/semantic-search/workspace/${ws}/setting`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
};

const search = (user: User, ws: string, query: string) => {
  mockAuthenticatedSession(user);
  return app.request(`/api/semantic-search/workspace/${ws}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
};

async function setup({ on = true } = {}) {
  const owner = await createWorkspaceMember({ role: "owner" });
  const ws = owner.workspace.id;
  if (on) expect((await turn(owner.user, ws, true)).status).toBe(200);
  const channel = async (name: string, extra = {}) => {
    const [row] = await db
      .insert(chatChannelTable)
      .values({ workspaceId: ws, name, createdBy: owner.user.id, ...extra })
      .returning();
    await db
      .insert(chatChannelMemberTable)
      .values({ channelId: row.id, userId: owner.user.id });
    return row;
  };
  const x = await channel("x");
  const y = await channel("y");
  const post = async (channelId: string, body: string) => {
    const [row] = await db
      .insert(chatMessageTable)
      .values({ channelId, body, userId: owner.user.id })
      .returning();
    return row;
  };
  const reason = await post(
    x.id,
    "We chose Northwind because their support answers fast",
  );
  await post(x.id, "Pizza lunch on Friday");
  await post(y.id, "Contoso was picked, keep this between us");
  const [doc] = await db
    .insert(documentTable)
    .values({
      workspaceId: ws,
      title: "Supplier decision",
      content: "Northwind won on support",
      creatorId: owner.user.id,
      scope: "workspace",
    })
    .returning();
  await db
    .update(chatChannelTable)
    .set({ aiDisabled: true })
    .where(eq(chatChannelTable.id, y.id));
  const project = await createProjectFixture({ workspaceId: ws });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.project.id,
      title: "Vendor decision follow-up",
      description: "Northwind contract chosen",
      status: "to-do",
      columnId: project.columns.todo.id,
      number: 1,
    })
    .returning();
  return { owner: owner.user, ws, x, y, reason, doc, task, project };
}

describe("API integration: semantic search", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    process.env.OPENROUTER_API_KEY = "test-key";
    process.env.EMBEDDING_API_KEY = "test-embedding-key";
    process.env.EMBEDDING_API_URL =
      "https://embeddings.example.test/v1/embeddings";
    model.queue.length = 0;
    model.seen.length = 0;
    embeddingCalls.length = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        if (String(url) !== process.env.EMBEDDING_API_URL)
          return realFetch(url, init);
        const { input } = JSON.parse(String(init?.body)) as { input: string[] };
        embeddingCalls.push(input);
        return new Response(
          JSON.stringify({
            data: input.map((text, index) => ({
              index,
              embedding: fakeEmbedding(text),
            })),
          }),
        );
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.EMBEDDING_API_KEY;
    delete process.env.EMBEDDING_API_URL;
  });

  it("answers with the right message and document though the words differ", async () => {
    const { owner, ws, reason, doc } = await setup();
    await indexSemanticChunks();
    const sentToEmbedder = JSON.stringify(embeddingCalls);
    // A no-AI channel never reaches the embedding service.
    expect(sentToEmbedder).not.toContain("Contoso was picked");

    model.queue.push(
      reply(
        JSON.stringify({
          answer: "Northwind was chosen for its fast support.",
          sources: [reason.id, doc.id, "made-up"],
        }),
      ),
    );
    const res = await search(owner, ws, "why did we pick the new vendor");
    expect(res.status, await res.clone().text()).toBe(200);
    const body = await res.json();
    expect(body.answer).toBe("Northwind was chosen for its fast support.");
    expect(
      body.sources.map((s: { kind: string; id: string }) => [s.kind, s.id]),
    ).toEqual([
      ["message", reason.id],
      ["document", doc.id],
    ]);
    const ids = body.results.map((r: { id: string }) => r.id);
    expect(ids).toContain(reason.id);
    expect(ids).toContain(doc.id);
    const sent = JSON.stringify(model.seen[0]);
    expect(sent).not.toContain("Contoso");
    expect(sent).not.toContain("Pizza lunch");
  });

  it("never embeds or answers from a direct message, even after the opt-in", async () => {
    const { owner, ws } = await setup();
    const [dm] = await db
      .insert(chatChannelTable)
      .values({
        workspaceId: ws,
        name: "dm",
        isPrivate: true,
        directKey: owner.id,
        createdBy: owner.id,
      })
      .returning();
    await db
      .insert(chatChannelMemberTable)
      .values({ channelId: dm.id, userId: owner.id });
    await db.insert(chatMessageTable).values({
      channelId: dm.id,
      body: "Contoso supplier chosen quietly",
      userId: owner.id,
    });
    mockAuthenticatedSession(owner);
    const optIn = await app.request(
      `/api/catch-up/workspace/${ws}/preference`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeDirectMessages: true }),
      },
    );
    expect(optIn.status).toBe(200);
    await indexSemanticChunks();
    expect(JSON.stringify(embeddingCalls)).not.toContain("chosen quietly");
    model.queue.push(reply(JSON.stringify({ answer: "-", sources: [] })));
    await search(owner, ws, "which supplier was chosen");
    expect(JSON.stringify(model.seen)).not.toContain("chosen quietly");
  });

  it("leaves out what the searcher cannot open", async () => {
    const { ws, owner, project, task } = await setup();
    await indexSemanticChunks();
    const member = (await createWorkspaceMember()).user;
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: member.id,
      role: "member",
      joinedAt: new Date(),
    });
    const other = await createProjectFixture({ workspaceId: ws });
    await restrictToProjects(ws, member.id, [other.project.id]);
    const [secret] = await db
      .insert(chatChannelTable)
      .values({
        workspaceId: ws,
        name: "secret",
        isPrivate: true,
        createdBy: owner.id,
      })
      .returning();
    await db
      .insert(chatChannelMemberTable)
      .values({ channelId: secret.id, userId: owner.id });
    const [hidden] = await db
      .insert(chatMessageTable)
      .values({
        channelId: secret.id,
        body: "Northwind chosen secretly",
        userId: owner.id,
      })
      .returning();
    await indexSemanticChunks();
    model.queue.push(reply(JSON.stringify({ answer: "-", sources: [] })));
    const body = await (
      await search(member, ws, "why did we pick the new vendor")
    ).json();
    const ids = body.results.map((r: { id: string }) => r.id);
    expect(ids).not.toContain(task.id);
    expect(ids).not.toContain(hidden.id);
    expect(JSON.stringify(model.seen)).not.toContain("secretly");
    expect(project).toBeTruthy();
  });

  it("drops a deleted message from results at once", async () => {
    const { owner, ws, reason } = await setup();
    await indexSemanticChunks();
    await db.delete(chatMessageTable).where(eq(chatMessageTable.id, reason.id));
    model.queue.push(reply(JSON.stringify({ answer: "-", sources: [] })));
    const body = await (
      await search(owner, ws, "why did we pick the new vendor")
    ).json();
    expect(body.results.map((r: { id: string }) => r.id)).not.toContain(
      reason.id,
    );
  });

  it("forgets a channel's messages once its AI is turned off, and re-embeds an edited message", async () => {
    const { owner, ws, x, reason } = await setup();
    await indexSemanticChunks();
    embeddingCalls.length = 0;
    await indexSemanticChunks();
    expect(embeddingCalls).toEqual([]);
    await db
      .update(chatMessageTable)
      .set({ body: "We chose Northwind for the release", editedAt: new Date() })
      .where(eq(chatMessageTable.id, reason.id));
    await indexSemanticChunks();
    expect(JSON.stringify(embeddingCalls)).toContain("for the release");

    // Turning AI off in the channel forgets what was embedded from it.
    mockAuthenticatedSession(owner);
    const off = await app.request(
      `/api/chat/workspace/${ws}/channels/${x.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiDisabled: true }),
      },
    );
    expect(off.status, await off.clone().text()).toBe(200);
    // Already embedded, it still never reaches an answer.
    model.queue.push(reply(JSON.stringify({ answer: "-", sources: [] })));
    const answer = await (
      await search(owner, ws, "why did we pick the new vendor")
    ).json();
    expect(answer.results.map((r: { id: string }) => r.id)).not.toContain(
      reason.id,
    );
    expect(JSON.stringify(model.seen)).not.toContain("for the release");
    embeddingCalls.length = 0;
    await indexSemanticChunks();
    expect(JSON.stringify(embeddingCalls)).not.toContain("Northwind");
    const chunks = await db
      .select()
      .from(semanticChunkTable)
      .where(eq(semanticChunkTable.messageId, reason.id));
    expect(chunks).toEqual([]);
  });

  it("is off for a workspace until an admin turns it on, and embeds nothing", async () => {
    const { owner, ws } = await setup({ on: false });
    expect(await indexSemanticChunks()).toEqual({ indexed: 0 });
    expect(embeddingCalls).toEqual([]);
    expect((await search(owner, ws, "vendor")).status).toBe(404);
    mockAuthenticatedSession(owner);
    expect(
      await (
        await app.request(`/api/semantic-search/workspace/${ws}/setting`)
      ).json(),
    ).toMatchObject({ enabled: false });

    const member = (await createWorkspaceMember()).user;
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: member.id,
      role: "member",
      joinedAt: new Date(),
    });
    expect((await turn(member, ws, true)).status).toBe(403);
    expect(await indexSemanticChunks()).toEqual({ indexed: 0 });
    expect(embeddingCalls).toEqual([]);
  });

  it("sends nothing when the workspace keeps its AI text on its own server", async () => {
    const { owner, ws } = await setup();
    process.env.AI_SELF_HOSTED_URL = "https://llm.internal.test/v1";
    await db.insert(aiDestinationChangeTable).values({
      workspaceId: ws,
      provider: "self-hosted",
      model: null,
      changedBy: owner.id,
      diff: [{ field: "provider", from: "openrouter", to: "self-hosted" }],
    });
    try {
      expect(await indexSemanticChunks()).toEqual({ indexed: 0 });
      expect(embeddingCalls).toEqual([]);
      expect((await search(owner, ws, "vendor")).status).toBe(404);
    } finally {
      delete process.env.AI_SELF_HOSTED_URL;
    }
  });

  it("checks the budget before embedding the question", async () => {
    const { owner, ws } = await setup();
    await indexSemanticChunks();
    embeddingCalls.length = 0;
    await setBudget(ws, { userDailyTokens: 1, workspaceMonthlyTokens: null });
    await recordUsage({
      workspaceId: ws,
      userId: owner.id,
      purpose: "search",
      model: "fake-model",
      promptTokens: 5,
      completionTokens: 0,
      cost: null,
    });
    expect((await search(owner, ws, "vendor")).status).toBe(429);
    expect(embeddingCalls).toEqual([]);
  });

  it("is off without an embedding key, and embeds nothing", async () => {
    const { owner, ws } = await setup();
    delete process.env.EMBEDDING_API_KEY;
    expect(await indexSemanticChunks()).toEqual({ indexed: 0 });
    expect(embeddingCalls).toEqual([]);
    expect((await search(owner, ws, "vendor")).status).toBe(404);
  });
});
