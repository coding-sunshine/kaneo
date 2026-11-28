import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import {
  documentTable,
  notificationTable,
} from "../../apps/api/src/database/schema";
import { createApp } from "../../apps/api/src/index";
import { model, reply } from "./helpers/agent-model";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";

vi.mock("../../apps/api/src/agent/openrouter", async (original) => ({
  ...(await original<object>()),
  createCompletion: vi.fn(async (messages: never) => {
    model.seen.push(messages);
    const next = model.queue.shift();
    if (!next) throw new Error("no scripted reply");
    return next;
  }),
}));

type User = typeof schema.userTable.$inferSelect;
type Proposal = {
  id: string;
  tool: string;
  status: string;
  diff: { field: string; to: string | null }[];
  sources: { kind: string; restricted: boolean; id?: string }[];
};

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

describe("API integration: extract a decision from a chat thread", () => {
  const { app } = createApp();
  let owner: User;
  let lead: User;
  let dana: User;
  let ws: string;
  let topicId: string;
  let channelId: string;
  let rootId: string;
  let optionB: string;
  let decided: string;

  const as = (user: User) => {
    mockAuthenticatedSession(user);
    return app;
  };
  const chat = "/api/chat/workspace";
  const post = async (user: User, body: string, parentId?: string) => {
    const res = await as(user).request(
      `${chat}/${ws}/channels/${channelId}/messages`,
      json("POST", { body, parentId }),
    );
    expect(res.status, await res.clone().text()).toBe(200);
    return ((await res.json()) as { id: string }).id;
  };

  beforeEach(async () => {
    await resetTestDatabase();
    process.env.OPENROUTER_API_KEY = "test-key";
    model.queue.length = 0;
    model.seen.length = 0;
    const seeded = await createWorkspaceMember({ role: "owner" });
    owner = seeded.user;
    ws = seeded.workspace.id;
    lead = await addWorkspaceMember(ws, "member");
    dana = await addWorkspaceMember(ws, "member");
    const topic = await as(owner).request(
      "/api/topic",
      json("POST", {
        workspaceId: ws,
        name: "Payments provider",
        deciderId: lead.id,
      }),
    );
    expect(topic.status, await topic.clone().text()).toBe(200);
    topicId = ((await topic.json()) as { id: string }).id;
    const created = await as(owner).request(
      `${chat}/${ws}/channels`,
      json("POST", { name: "payments" }),
    );
    channelId = ((await created.json()) as { id: string }).id;
    for (const user of [lead, dana]) {
      await as(user).request(
        `${chat}/${ws}/channels/${channelId}/join`,
        json("POST"),
      );
    }
    rootId = await post(
      owner,
      "Option A or option B for the payments provider?",
    );
    await post(dana, "Option A is cheaper per transaction.", rootId);
    optionB = await post(
      lead,
      "Option B supports 3DS challenges out of the box.",
      rootId,
    );
    await post(dana, "That saves us a month of work.", rootId);
    decided = await post(lead, "ok, we go with option B", rootId);
  });

  const suggestion = (overrides: object = {}) =>
    reply(
      JSON.stringify({
        decision: "Use option B as the payments provider",
        deciderId: lead.id,
        reason:
          "It supports 3DS challenges out of the box, which saves a month.",
        messageIds: [optionB, decided, "made-up-id"],
        topicId,
        ...overrides,
      }),
    );

  const extract = (
    user: User = owner,
    messageId = rootId,
    channel = channelId,
  ) =>
    as(user).request(
      `/api/agent/workspace/${ws}/channels/${channel}/messages/${messageId}/decision-proposal`,
      json("POST"),
    );
  const decide = (id: string, decision: "accept" | "decline") =>
    as(owner).request(
      `/api/agent/workspace/${ws}/proposals/${id}/${decision}`,
      json("POST"),
    );
  const documents = () => db.select().from(documentTable);

  it("shows the decision, who decided and why, with links to the messages", async () => {
    model.queue.push(suggestion());
    const res = await extract();
    expect(res.status, await res.clone().text()).toBe(200);
    const card = (await res.json()) as Proposal;
    expect(card).toMatchObject({
      tool: "file_decision_draft",
      status: "pending",
    });
    expect(Object.fromEntries(card.diff.map((c) => [c.field, c.to]))).toEqual({
      topic: "Payments provider",
      decision: "Use option B as the payments provider",
      decider: lead.name,
      reason: expect.stringContaining("3DS"),
    });
    // Only messages of the thread are cited.
    expect(card.sources).toEqual([
      expect.objectContaining({
        kind: "message",
        restricted: false,
        id: optionB,
      }),
      expect.objectContaining({
        kind: "message",
        restricted: false,
        id: decided,
      }),
    ]);
    expect(JSON.stringify(model.seen[0])).toContain("ok, we go with option B");
    expect(await documents()).toEqual([]);
  });

  it("files a draft on the topic on Accept and asks the topic's decider to approve it", async () => {
    model.queue.push(suggestion());
    const card = (await (await extract()).json()) as Proposal;
    const res = await decide(card.id, "accept");
    expect(res.status, await res.clone().text()).toBe(200);
    expect((await res.json()).status).toBe("accepted");
    const [doc] = await documents();
    expect(doc).toMatchObject({ topicId, status: "in_review" });
    expect(doc?.content).toContain("Use option B as the payments provider");
    expect(doc?.content).toContain(`messageId=${decided}`);
    const asks = await db
      .select()
      .from(notificationTable)
      .where(
        and(
          eq(notificationTable.userId, lead.id),
          eq(notificationTable.resourceId, doc?.id ?? ""),
        ),
      );
    expect(asks).toMatchObject([{ type: "document_proposed" }]);
  });

  it("files nothing on Decline", async () => {
    model.queue.push(suggestion());
    const card = (await (await extract()).json()) as Proposal;
    expect((await (await decide(card.id, "decline")).json()).status).toBe(
      "declined",
    );
    expect(await documents()).toEqual([]);
  });

  it("drops a decider who is not in the thread and refuses a topic the asker cannot open", async () => {
    const stranger = await addWorkspaceMember(ws, "member");
    model.queue.push(suggestion({ deciderId: stranger.id }));
    const card = (await (await extract()).json()) as Proposal;
    expect(card.diff.map((c) => c.field)).not.toContain("decider");
    model.queue.push(suggestion({ topicId: "invented-topic" }));
    expect((await extract()).status).toBe(422);
  });

  it("refuses the action in a channel marked no AI, without asking the model", async () => {
    const off = await as(owner).request(
      `${chat}/${ws}/channels/${channelId}`,
      json("PATCH", { aiDisabled: true }),
    );
    expect(off.status, await off.clone().text()).toBe(200);
    expect((await off.json()).aiDisabled).toBe(true);
    const res = await extract();
    expect(res.status).toBe(403);
    expect(model.seen).toHaveLength(0);
    // Ticket drafting from the thread is refused there too.
    const ticket = await as(owner).request(
      `/api/agent/workspace/${ws}/channels/${channelId}/messages/${rootId}/ticket-proposal`,
      json("POST"),
    );
    expect(ticket.status).toBe(403);
  });

  it("only lets a member of the channel mark it no AI", async () => {
    const outsider = await addWorkspaceMember(ws, "member");
    const res = await as(outsider).request(
      `${chat}/${ws}/channels/${channelId}`,
      json("PATCH", { aiDisabled: true }),
    );
    expect(res.status).toBe(403);
  });

  it("hides a private thread from a non-member", async () => {
    const leads = await as(owner).request(
      `${chat}/${ws}/channels`,
      json("POST", { name: "leads", isPrivate: true }),
    );
    const leadsId = ((await leads.json()) as { id: string }).id;
    const secret = await as(owner).request(
      `${chat}/${ws}/channels/${leadsId}/messages`,
      json("POST", { body: "we go with option C" }),
    );
    const secretId = ((await secret.json()) as { id: string }).id;
    expect((await extract(dana, secretId, leadsId)).status).toBe(404);
    expect(model.seen).toHaveLength(0);
  });
});
