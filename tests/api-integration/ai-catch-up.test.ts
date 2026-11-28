import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import {
  aiCatchUpPreferenceTable,
  chatChannelAiExclusionTable,
  chatChannelMemberTable,
  chatChannelTable,
  chatMessageTable,
  chatThreadReplyTable,
  taskSubscriberTable,
} from "../../apps/api/src/database/schema";
import { createApp } from "../../apps/api/src/index";
import { model, reply } from "./helpers/agent-model";
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

type User = typeof schema.userTable.$inferSelect;
const { app } = createApp();
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000);

const request = (user: User, path: string, method = "GET", body?: object) => {
  mockAuthenticatedSession(user);
  return app.request(`/api${path}`, {
    method,
    ...(body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
};

async function setup() {
  const a = await createWorkspaceMember({ role: "owner", userName: "Avery" });
  const ws = a.workspace.id;
  const b = (await createWorkspaceMember({ userName: "Blair" })).user;
  await db.insert(schema.workspaceUserTable).values({
    workspaceId: ws,
    userId: b.id,
    role: "member",
    joinedAt: new Date(),
  });
  const channel = async (name: string, extra = {}) => {
    const [row] = await db
      .insert(chatChannelTable)
      .values({ workspaceId: ws, name, createdBy: a.user.id, ...extra })
      .returning();
    return row;
  };
  const x = await channel("x");
  const y = await channel("y");
  const dm = await channel("dm", {
    isPrivate: true,
    directKey: [a.user.id, b.id].sort().join(":"),
  });
  const secret = await channel("secret", { isPrivate: true });
  for (const c of [x, y, dm, secret])
    await db.insert(chatChannelMemberTable).values({
      channelId: c.id,
      userId: a.user.id,
    });
  for (const c of [x, y, dm])
    await db.insert(chatChannelMemberTable).values({
      channelId: c.id,
      userId: b.id,
      lastReadAt: hoursAgo(48),
    });
  const post = async (
    channelId: string,
    body: string,
    userId: string,
    at: Date,
  ) => {
    const [row] = await db
      .insert(chatMessageTable)
      .values({ channelId, body, userId, createdAt: at })
      .returning();
    return row;
  };
  const project = await createProjectFixture({ workspaceId: ws, slug: "web" });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.project.id,
      title: "Checkout flow",
      status: "to-do",
      columnId: project.columns.todo.id,
      number: 1,
    })
    .returning();
  return { a: a.user, b, ws, x, y, dm, secret, post, task };
}

describe("API integration: private catch-up", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    process.env.OPENROUTER_API_KEY = "test-key";
    model.queue.length = 0;
    model.seen.length = 0;
  });

  it("summarises unread channels, my threads and followed tickets, each bullet linked", async () => {
    const { a, b, ws, x, y, dm, secret, post, task } = await setup();
    await db
      .insert(chatChannelAiExclusionTable)
      .values({ channelId: y.id, setBy: a.id });
    const news = await post(
      x.id,
      "Vendor chosen: Northwind",
      a.id,
      hoursAgo(2),
    );
    await post(x.id, "Too old to count", a.id, hoursAgo(30));
    await post(y.id, "Excluded salary talk", a.id, hoursAgo(2));
    await post(dm.id, "Private DM words", a.id, hoursAgo(2));
    await post(secret.id, "Secret channel words", a.id, hoursAgo(2));
    const mine = await post(
      x.id,
      "My question about launch",
      b.id,
      hoursAgo(40),
    );
    const answer = await post(
      x.id,
      "Launch moves to Friday",
      a.id,
      hoursAgo(3),
    );
    await db
      .insert(chatThreadReplyTable)
      .values({ messageId: answer.id, parentId: mine.id });
    await db
      .insert(taskSubscriberTable)
      .values({ taskId: task.id, userId: b.id });
    const [comment] = await db
      .insert(schema.activityTable)
      .values({
        taskId: task.id,
        type: "comment",
        userId: a.id,
        content: "Checkout now uses the new gateway",
        createdAt: hoursAgo(1),
      })
      .returning();

    model.queue.push(
      reply(
        JSON.stringify({
          bullets: [
            { text: "A vendor was chosen", sources: [news.id] },
            { text: "Launch moved to Friday", sources: [answer.id] },
            { text: "Checkout uses the new gateway", sources: [comment.id] },
            { text: "Avery was the most active person", sources: [news.id] },
            { text: "Made up", sources: ["nope"] },
          ],
        }),
      ),
    );
    const res = await request(b, `/catch-up/workspace/${ws}`, "POST", {
      hours: 24,
    });
    expect(res.status, await res.clone().text()).toBe(200);
    const body = await res.json();
    expect(body.bullets.map((bullet: { text: string }) => bullet.text)).toEqual(
      [
        "A vendor was chosen",
        "Launch moved to Friday",
        "Checkout uses the new gateway",
      ],
    );
    expect(body.bullets[0].sources).toEqual([
      expect.objectContaining({
        kind: "message",
        restricted: false,
        id: news.id,
        channelId: x.id,
      }),
    ]);
    // A thread reply links to its thread.
    expect(body.bullets[1].sources[0]).toMatchObject({
      kind: "message",
      id: mine.id,
      channelId: x.id,
    });
    expect(body.bullets[2].sources[0]).toMatchObject({
      kind: "comment",
      taskId: task.id,
    });

    const sent = JSON.stringify(model.seen[0]);
    expect(sent).toContain("Vendor chosen: Northwind");
    expect(sent).toContain("Launch moves to Friday");
    expect(sent).toContain("Checkout now uses the new gateway");
    for (const absent of [
      "Too old to count",
      "Excluded salary talk",
      "Private DM words",
      "Secret channel words",
    ])
      expect(sent).not.toContain(absent);
    expect(sent).toMatch(/never rank/i);
  });

  it("reads my direct messages only after I opt in", async () => {
    const { b, ws, dm, a, post } = await setup();
    await post(dm.id, "Private DM words", a.id, hoursAgo(2));
    const get = await request(b, `/catch-up/workspace/${ws}/preference`);
    expect(await get.json()).toEqual({ includeDirectMessages: false });
    const put = await request(
      b,
      `/catch-up/workspace/${ws}/preference`,
      "PUT",
      { includeDirectMessages: true },
    );
    expect(put.status).toBe(200);
    model.queue.push(reply(JSON.stringify({ bullets: [] })));
    await request(b, `/catch-up/workspace/${ws}`, "POST", { hours: 24 });
    expect(JSON.stringify(model.seen[0])).toContain("Private DM words");
    // My opt-in is mine only.
    const [row] = await db.select().from(aiCatchUpPreferenceTable);
    expect(row).toMatchObject({ userId: b.id, includeDirectMessages: true });
  });

  it("asks no model when nothing is new, and stores nothing", async () => {
    const { b, ws } = await setup();
    const res = await request(b, `/catch-up/workspace/${ws}`, "POST", {
      hours: 24,
    });
    expect(res.status).toBe(200);
    expect((await res.json()).bullets).toEqual([]);
    expect(model.seen).toHaveLength(0);
  });

  it("refuses another workspace and is off without a model key", async () => {
    const { ws, b } = await setup();
    const stranger = await createWorkspaceMember({ role: "owner" });
    expect(
      (
        await request(stranger.user, `/catch-up/workspace/${ws}`, "POST", {
          hours: 24,
        })
      ).status,
    ).toBe(404);
    delete process.env.OPENROUTER_API_KEY;
    expect(
      (await request(b, `/catch-up/workspace/${ws}`, "POST", { hours: 24 }))
        .status,
    ).toBe(404);
  });
});

describe("API integration: marking a channel no AI", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  const path = (ws: string, channelId: string) =>
    `/channel-ai/workspace/${ws}/channels/${channelId}`;

  it("lets a channel member mark and unmark it", async () => {
    const { a, ws, x } = await setup();
    expect(await (await request(a, path(ws, x.id))).json()).toEqual({
      excluded: false,
    });
    const on = await request(a, path(ws, x.id), "PUT", { excluded: true });
    expect(on.status, await on.clone().text()).toBe(200);
    expect(await (await request(a, path(ws, x.id))).json()).toEqual({
      excluded: true,
    });
    await request(a, path(ws, x.id), "PUT", { excluded: false });
    expect(await db.select().from(chatChannelAiExclusionTable)).toEqual([]);
  });

  it("refuses non-members, viewers and channels the caller cannot see", async () => {
    const { b, ws, x, secret } = await setup();
    // b is not a member of secret: it answers like a missing channel.
    expect(
      (await request(b, path(ws, secret.id), "PUT", { excluded: true })).status,
    ).toBe(404);
    const viewer = (await createWorkspaceMember()).user;
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: viewer.id,
      role: "viewer",
      joinedAt: new Date(),
    });
    expect(
      (await request(viewer, path(ws, x.id), "PUT", { excluded: true })).status,
    ).toBe(403);
    const outsider = (await createWorkspaceMember()).user;
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: outsider.id,
      role: "member",
      joinedAt: new Date(),
    });
    // Not a member of x: may read it but not mark it.
    expect(
      (await request(outsider, path(ws, x.id), "PUT", { excluded: true }))
        .status,
    ).toBe(403);
    expect(await db.select().from(chatChannelAiExclusionTable)).toEqual([]);
  });
});
