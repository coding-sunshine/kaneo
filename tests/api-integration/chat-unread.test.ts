import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
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

async function setup() {
  const a = await createWorkspaceMember({ role: "owner" });
  const b = await createWorkspaceMember();
  const c = await createWorkspaceMember();
  const outsider = await createWorkspaceMember();
  const ws = a.workspace.id;
  for (const member of [b, c])
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: member.user.id,
      role: "member",
      joinedAt: new Date(),
    });
  const { app } = createApp();
  const base = `/api/chat/workspace/${ws}/channels`;
  const as = (member: Seeded) => {
    mockAuthenticatedSession(member.user);
    return (path: string, init?: RequestInit) => app.request(path, init);
  };
  const create = async (name: string, isPrivate = false) =>
    (await as(a)(base, json("POST", { name, isPrivate }))).json();
  const pub = await create("general");
  const priv = await create("leads", true);
  await as(b)(`${base}/${pub.id}/join`, json("POST"));
  const post = async (channelId: string, body: string, member = a) =>
    as(member)(`${base}/${channelId}/messages`, json("POST", { body }));
  const unread = async (member: Seeded) =>
    Object.fromEntries(
      (await (await as(member)(base)).json()).map(
        (channel: { name: string; unreadCount: number }) => [
          channel.name,
          channel.unreadCount,
        ],
      ),
    );
  const markRead = (member: Seeded, channelId: string) =>
    as(member)(`${base}/${channelId}/read`, json("POST"));
  return { a, b, c, outsider, ws, base, as, pub, priv, post, unread, markRead };
}

describe("API integration: chat unread state", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("counts new messages from others in channels you joined", async () => {
    const { a, b, c, pub, post, unread } = await setup();
    await post(pub.id, "one");
    await post(pub.id, "two");

    expect(await unread(b)).toEqual({ general: 2 });
    // Your own messages and channels you have not joined count nothing.
    expect(await unread(a)).toEqual({ general: 0, leads: 0 });
    expect(await unread(c)).toEqual({ general: 0 });
  });

  it("clears the count when you open the channel, and keeps it cleared", async () => {
    const { b, pub, post, unread, markRead } = await setup();
    await post(pub.id, "one");

    expect((await markRead(b, pub.id)).status).toBe(200);
    expect(await unread(b)).toEqual({ general: 0 });
    expect(await unread(b)).toEqual({ general: 0 });

    await post(pub.id, "two");
    expect(await unread(b)).toEqual({ general: 1 });
  });

  // A reply never becomes the channel's newest message, so an open channel
  // would not mark it read: it would leave a count nobody can clear.
  it("leaves thread replies out of the count", async () => {
    const { a, b, as, base, pub, post, unread, markRead } = await setup();
    const parent = await (await post(pub.id, "question", b)).json();
    await markRead(b, pub.id);

    const reply = await as(a)(
      `${base}/${pub.id}/messages`,
      json("POST", { body: "answer", parentId: parent.id }),
    );
    expect(reply.status).toBe(200);
    expect(await unread(b)).toEqual({ general: 0 });
  });

  it("tells the author nothing about who read their message", async () => {
    const { a, b, base, as, pub, post, markRead } = await setup();
    await post(pub.id, "one");
    const before = await Promise.all([
      (await as(a)(`${base}/${pub.id}`)).json(),
      (await as(a)(base)).json(),
      (await as(a)(`${base}/${pub.id}/messages`)).json(),
    ]);

    await markRead(b, pub.id);

    const after = await Promise.all([
      (await as(a)(`${base}/${pub.id}`)).json(),
      (await as(a)(base)).json(),
      (await as(a)(`${base}/${pub.id}/messages`)).json(),
    ]);
    expect(after).toEqual(before);
  });

  it("marks only channels you can read", async () => {
    const { b, outsider, as, priv, markRead } = await setup();
    expect((await markRead(b, priv.id)).status).toBe(404);
    expect(
      (
        await as(outsider)(
          `/api/chat/workspace/${outsider.workspace.id}/channels/${priv.id}/read`,
          json("POST"),
        )
      ).status,
    ).toBe(404);
  });

  it("counts unread messages in a direct message for its other member only", async () => {
    const { a, b, c, ws, as, post, markRead } = await setup();
    const directs = `/api/chat/workspace/${ws}/direct-messages`;
    const direct = await (
      await as(a)(directs, json("POST", { userIds: [b.user.id] }))
    ).json();
    await post(direct.id, "hello there");
    const dmUnread = async (member: Seeded) =>
      (await (await as(member)(directs)).json()).map(
        (dm: { id: string; unreadCount: number }) => [dm.id, dm.unreadCount],
      );

    expect(await dmUnread(b)).toEqual([[direct.id, 1]]);
    expect(await dmUnread(a)).toEqual([[direct.id, 0]]);
    expect(await dmUnread(c)).toEqual([]);
    expect((await markRead(c, direct.id)).status).toBe(404);

    const before = await (await as(a)(directs)).json();
    expect((await markRead(b, direct.id)).status).toBe(200);
    expect(await dmUnread(b)).toEqual([[direct.id, 0]]);
    expect(await (await as(a)(directs)).json()).toEqual(before);
  });
});
