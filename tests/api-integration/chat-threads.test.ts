import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { chatMessageTable } from "../../apps/api/src/database/schema";
import { settleEvents, subscribeToEvent } from "../../apps/api/src/events";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

type Seeded = Awaited<ReturnType<typeof createWorkspaceMember>>;
type Message = {
  id: string;
  body: string;
  parentId: string | null;
  replyCount: number;
};

const created: { channelId: string; parentId?: string | null }[] = [];
subscribeToEvent<{ channelId: string; parentId?: string | null }>(
  "chat.message_created",
  async (event) => {
    created.push(event);
  },
);

async function setup() {
  const author = await createWorkspaceMember({ role: "owner" });
  const other = await createWorkspaceMember();
  const viewer = await createWorkspaceMember();
  const guest = await createWorkspaceMember();
  const ws = author.workspace.id;
  for (const [member, role] of [
    [other, "member"],
    [viewer, "viewer"],
    [guest, "member"],
  ] as const)
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: member.user.id,
      role,
      joinedAt: new Date(),
    });
  await db.insert(schema.workspaceMemberAccessTable).values({
    workspaceId: ws,
    userId: guest.user.id,
    projectAccess: "selected",
    guest: true,
  });
  const { app } = createApp();
  const base = `/api/chat/workspace/${ws}/channels`;
  const as = (member: Seeded) => {
    mockAuthenticatedSession(member.user);
    return (path: string, init?: RequestInit) => app.request(path, init);
  };
  const create = async (name: string, isPrivate = false) =>
    (await as(author)(base, json("POST", { name, isPrivate }))).json();
  const pub = await create("general");
  const priv = await create("leads", true);
  await as(other)(`${base}/${pub.id}/join`, json("POST"));
  await as(author)(
    `${base}/${pub.id}/members`,
    json("POST", { userId: viewer.user.id }),
  );
  const post = (
    member: Seeded,
    channelId: string,
    body: string,
    parentId?: string,
  ) =>
    as(member)(
      `${base}/${channelId}/messages`,
      json("POST", parentId ? { body, parentId } : { body }),
    );
  const parent: Message = await (
    await post(author, pub.id, "Shall we ship?")
  ).json();
  const secret: Message = await (
    await post(author, priv.id, "private note")
  ).json();
  const timeline = async (member: Seeded, channelId = pub.id) =>
    as(member)(`${base}/${channelId}/messages`);
  const replies = (member: Seeded, channelId: string, messageId: string) =>
    as(member)(`${base}/${channelId}/messages/${messageId}/replies`);
  return {
    author,
    other,
    viewer,
    guest,
    as,
    base,
    pub,
    priv,
    parent,
    secret,
    post,
    timeline,
    replies,
  };
}

describe("API integration: chat threads", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    created.length = 0;
  });

  it("keeps replies under their message and out of the channel timeline", async () => {
    const { author, other, viewer, pub, parent, post, timeline, replies } =
      await setup();

    const first = await post(other, pub.id, "Yes, today", parent.id);
    expect(first.status, await first.clone().text()).toBe(200);
    expect(await first.json()).toMatchObject({
      parentId: parent.id,
      replyCount: 0,
    });
    await post(author, pub.id, "Agreed", parent.id);
    await settleEvents();

    const seen: Message[] = await (await timeline(viewer)).json();
    expect(seen).toEqual([
      expect.objectContaining({ id: parent.id, parentId: null, replyCount: 2 }),
    ]);

    const thread = await replies(viewer, pub.id, parent.id);
    expect(thread.status).toBe(200);
    const listed: Message[] = await thread.json();
    expect(listed.map((reply) => [reply.body, reply.parentId])).toEqual([
      ["Yes, today", parent.id],
      ["Agreed", parent.id],
    ]);

    // Live clients hear about each reply on the channel, with its parent.
    expect(created.filter((event) => event.parentId === parent.id)).toEqual([
      expect.objectContaining({ channelId: pub.id }),
      expect.objectContaining({ channelId: pub.id }),
    ]);
  });

  it("files a reply to a reply under the first message of the thread", async () => {
    const { author, other, pub, parent, post, replies } = await setup();
    const reply: Message = await (
      await post(other, pub.id, "first", parent.id)
    ).json();

    const nested = await post(author, pub.id, "second", reply.id);
    expect(nested.status).toBe(200);
    expect((await nested.json()).parentId).toBe(parent.id);
    const listed: Message[] = await (
      await replies(author, pub.id, parent.id)
    ).json();
    expect(listed.map((item) => item.body)).toEqual(["first", "second"]);
  });

  it("refuses a parent from another channel or one that does not exist", async () => {
    const { author, pub, secret, post, replies } = await setup();

    for (const parentId of [secret.id, "no-such-message"]) {
      expect((await post(author, pub.id, "hi", parentId)).status).toBe(404);
      expect((await replies(author, pub.id, parentId)).status).toBe(404);
    }
    const rows = await db
      .select({ id: chatMessageTable.id })
      .from(chatMessageTable)
      .where(eq(chatMessageTable.channelId, pub.id));
    expect(rows).toHaveLength(1);
  });

  it("gives everyone who cannot read the channel the channel's own answer", async () => {
    const { other, guest, pub, priv, parent, secret, post, timeline, replies } =
      await setup();
    const stranger = await createWorkspaceMember();

    for (const [member, channelId, messageId] of [
      [other, priv.id, secret.id],
      [guest, pub.id, parent.id],
      [stranger, pub.id, parent.id],
    ] as const) {
      const denied = (await timeline(member, channelId)).status;
      expect(denied).not.toBe(200);
      expect((await replies(member, channelId, messageId)).status).toBe(denied);
      expect((await post(member, channelId, "sneak", messageId)).status).toBe(
        denied,
      );
    }
  });

  it("lets a read-only viewer read a thread but not reply", async () => {
    const { viewer, pub, parent, post, replies } = await setup();

    expect((await replies(viewer, pub.id, parent.id)).status).toBe(200);
    expect((await post(viewer, pub.id, "me too", parent.id)).status).toBe(403);
  });

  it("deletes a thread's replies with its first message", async () => {
    const { author, other, as, base, pub, parent, post } = await setup();
    const reply: Message = await (
      await post(other, pub.id, "gone soon", parent.id)
    ).json();

    const deleted = await as(author)(
      `${base}/${pub.id}/messages/${parent.id}`,
      json("DELETE"),
    );
    expect(deleted.status).toBe(200);
    const rows = await db
      .select({ id: chatMessageTable.id })
      .from(chatMessageTable)
      .where(eq(chatMessageTable.id, reply.id));
    expect(rows).toEqual([]);
  });

  it("opens a reply found in search on the page that holds its thread", async () => {
    const { other, viewer, as, base, pub, parent, post } = await setup();
    const reply: Message = await (
      await post(other, pub.id, "needle", parent.id)
    ).json();

    const page = await as(viewer)(
      `${base}/${pub.id}/messages?around=${reply.id}`,
    );
    expect(page.status).toBe(200);
    expect(
      ((await page.json()) as Message[]).map((message) => message.id),
    ).toEqual([parent.id]);
  });
});
