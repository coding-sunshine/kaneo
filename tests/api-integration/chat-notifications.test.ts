import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { chatChannelMemberTable } from "../../apps/api/src/database/schema";
import { settleEvents } from "../../apps/api/src/events";
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
type Row = {
  type: string;
  resourceType: string | null;
  resourceId: string | null;
  eventData: Record<string, unknown> | null;
};

const mention = (id: string) => `<kaneo-mention id="${id}"></kaneo-mention>`;

async function setup() {
  const author = await createWorkspaceMember({
    role: "owner",
    userName: "Author",
  });
  const reader = await createWorkspaceMember();
  const other = await createWorkspaceMember();
  const viewer = await createWorkspaceMember();
  const guest = await createWorkspaceMember();
  const outsider = await createWorkspaceMember();
  const ws = author.workspace.id;
  for (const [member, role] of [
    [reader, "member"],
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
  const channels = `/api/chat/workspace/${ws}/channels`;
  const as = (member: Seeded) => {
    mockAuthenticatedSession(member.user);
    return (path: string, init?: RequestInit) => app.request(path, init);
  };
  const createChannel = async (name: string, isPrivate = false) =>
    (await (
      await as(author)(channels, json("POST", { name, isPrivate }))
    ).json()) as { id: string };
  const general = await createChannel("general");
  const leads = await createChannel("leads", true);
  await as(reader)(`${channels}/${general.id}/join`, json("POST"));
  await as(other)(`${channels}/${general.id}/join`, json("POST"));
  const post = async (
    channelId: string,
    body: string,
    member: Seeded = author,
    parentId?: string,
  ) => {
    const response = await as(member)(
      `${channels}/${channelId}/messages`,
      json("POST", parentId ? { body, parentId } : { body }),
    );
    expect(response.status, await response.clone().text()).toBe(200);
    await settleEvents();
    return (await response.json()) as { id: string };
  };
  const openDirect = async (member: Seeded, others: Seeded[]) =>
    (await (
      await as(member)(
        `/api/chat/workspace/${ws}/direct-messages`,
        json("POST", { userIds: others.map((o) => o.user.id) }),
      )
    ).json()) as { id: string };
  const inbox = async (member: Seeded, workspaceId: string | null = ws) => {
    const response = await as(member)(
      workspaceId
        ? `/api/notification?workspaceId=${workspaceId}`
        : "/api/notification",
    );
    expect(response.status).toBe(200);
    return (await response.json()) as Row[];
  };
  const mute = (member: Seeded, channelId: string, muted: boolean) =>
    as(member)(`${channels}/${channelId}/mute`, json("PUT", { muted }));
  return {
    author,
    reader,
    other,
    viewer,
    guest,
    outsider,
    ws,
    channels,
    as,
    general,
    leads,
    post,
    openDirect,
    inbox,
    mute,
  };
}

describe("API integration: chat notifications", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("gives one inbox row for a mention and one for a direct message, each naming its message", async () => {
    const { author, reader, ws, general, post, openDirect, inbox } =
      await setup();

    const mentioned = await post(
      general.id,
      `hi ${mention(reader.user.id)} can you look?`,
    );
    const direct = await openDirect(author, [reader]);
    const sent = await post(direct.id, "quick question");

    for (const workspaceId of [ws, null]) {
      const rows = await inbox(reader, workspaceId);
      expect(rows).toHaveLength(2);
      expect(rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "chat_mention",
            resourceType: "chat_message",
            resourceId: mentioned.id,
            eventData: expect.objectContaining({
              workspaceId: ws,
              channelId: general.id,
              messageId: mentioned.id,
              channelName: "general",
              actorName: "Author",
              messagePreview: "hi  can you look?",
            }),
          }),
          expect.objectContaining({
            type: "chat_direct_message",
            resourceType: "chat_message",
            resourceId: sent.id,
            eventData: expect.objectContaining({
              workspaceId: ws,
              channelId: direct.id,
              messageId: sent.id,
              channelName: null,
              messagePreview: "quick question",
            }),
          }),
        ]),
      );
    }
    expect(await inbox(author)).toEqual([]);
    // Filtered to another workspace, the rows stay out.
    expect(await inbox(reader, reader.workspace.id)).toEqual([]);
  });

  it("gives no row for a plain channel message, a self mention or a mention inside a direct message twice", async () => {
    const { author, reader, other, general, post, openDirect, inbox } =
      await setup();

    await post(general.id, "morning all");
    await post(general.id, `note to self ${mention(author.user.id)}`);
    expect(await inbox(reader)).toEqual([]);
    expect(await inbox(other)).toEqual([]);
    expect(await inbox(author)).toEqual([]);

    const direct = await openDirect(author, [reader]);
    await post(direct.id, `${mention(reader.user.id)} see this`);
    const rows = await inbox(reader);
    expect(rows.map((row) => row.type)).toEqual(["chat_direct_message"]);
  });

  it("notifies only people who can read the channel", async () => {
    const { reader, guest, outsider, general, leads, post, inbox } =
      await setup();

    await post(leads.id, `secret plan ${mention(reader.user.id)}`);
    expect(await inbox(reader, null)).toEqual([]);

    // A guest reads only channels they joined; an outsider none at all.
    await post(
      general.id,
      `${mention(guest.user.id)} ${mention(outsider.user.id)}`,
    );
    expect(await inbox(guest, null)).toEqual([]);
    expect(await inbox(outsider, null)).toEqual([]);

    // Once the guest is in the channel, a mention reaches them.
    await db
      .insert(chatChannelMemberTable)
      .values({ channelId: general.id, userId: guest.user.id });
    await post(general.id, `${mention(guest.user.id)} welcome`);
    expect((await inbox(guest)).map((row) => row.type)).toEqual([
      "chat_mention",
    ]);
  });

  it("keeps a guest's direct message row only while they still work with its people", async () => {
    const { author, guest, general, post, openDirect, inbox } = await setup();
    await db
      .insert(chatChannelMemberTable)
      .values({ channelId: general.id, userId: guest.user.id });
    const direct = await openDirect(author, [guest]);
    await post(direct.id, "welcome aboard");
    expect((await inbox(guest)).map((row) => row.type)).toEqual([
      "chat_direct_message",
    ]);

    // Sharing #general was all they had in common.
    await db
      .delete(chatChannelMemberTable)
      .where(
        and(
          eq(chatChannelMemberTable.channelId, general.id),
          eq(chatChannelMemberTable.userId, guest.user.id),
        ),
      );
    expect(await inbox(guest)).toEqual([]);
  });

  it("notifies a member who has not joined a public channel", async () => {
    const { viewer, general, post, inbox } = await setup();
    await post(general.id, `${mention(viewer.user.id)} fyi`);
    expect((await inbox(viewer)).map((row) => row.type)).toEqual([
      "chat_mention",
    ]);
  });

  it("hides a row once its reader loses the channel or the message is gone", async () => {
    const { author, reader, channels, as, leads, general, post, inbox } =
      await setup();
    await as(author)(
      `${channels}/${leads.id}/members`,
      json("POST", { userId: reader.user.id }),
    );
    await post(leads.id, `${mention(reader.user.id)} welcome`);
    expect(await inbox(reader)).toHaveLength(1);

    const removed = await as(author)(
      `${channels}/${leads.id}/members/${reader.user.id}`,
      json("DELETE"),
    );
    expect(removed.status).toBe(200);
    expect(await inbox(reader)).toEqual([]);

    const gone = await post(general.id, `${mention(reader.user.id)} oops`);
    expect(await inbox(reader)).toHaveLength(1);
    const deleted = await as(author)(
      `${channels}/${general.id}/messages/${gone.id}`,
      json("DELETE"),
    );
    expect(deleted.status).toBe(200);
    expect(await inbox(reader)).toEqual([]);
  });

  it("stops rows from a muted channel, for that person only, until unmuted", async () => {
    const {
      author,
      reader,
      other,
      channels,
      as,
      general,
      post,
      openDirect,
      inbox,
      mute,
    } = await setup();

    const muted = await mute(reader, general.id, true);
    expect(muted.status, await muted.clone().text()).toBe(200);
    expect(await muted.json()).toEqual({ channelId: general.id, muted: true });
    const detail = await (await as(reader)(`${channels}/${general.id}`)).json();
    expect(detail.isMuted).toBe(true);
    const othersView = await (
      await as(other)(`${channels}/${general.id}`)
    ).json();
    expect(othersView.isMuted).toBe(false);

    await post(
      general.id,
      `${mention(reader.user.id)} ${mention(other.user.id)} later`,
    );
    expect(await inbox(reader)).toEqual([]);
    expect(await inbox(other)).toHaveLength(1);

    const direct = await openDirect(author, [reader]);
    expect((await mute(reader, direct.id, true)).status).toBe(200);
    await post(direct.id, "ping");
    expect(await inbox(reader)).toEqual([]);

    expect((await mute(reader, general.id, false)).status).toBe(200);
    await post(general.id, `${mention(reader.user.id)} again`);
    expect((await inbox(reader)).map((row) => row.type)).toEqual([
      "chat_mention",
    ]);
  });

  it("lets anyone who reads a channel mute it, and no one else", async () => {
    const { viewer, other, guest, outsider, general, leads, mute } =
      await setup();

    // Readers who never joined, viewers included, may mute a public channel.
    expect((await mute(viewer, general.id, true)).status).toBe(200);
    // A private channel answers like a missing one to non-members.
    expect((await mute(other, leads.id, true)).status).toBe(404);
    expect((await mute(guest, general.id, true)).status).toBe(404);
    expect((await mute(outsider, general.id, true)).status).toBe(404);
  });

  it("notifies a mention in a thread reply", async () => {
    const { reader, other, general, post, inbox } = await setup();
    const parent = await post(general.id, "Shall we ship?");
    const reply = await post(
      general.id,
      `${mention(reader.user.id)} thoughts?`,
      other,
      parent.id,
    );
    const rows = await inbox(reader);
    expect(rows).toEqual([
      expect.objectContaining({
        type: "chat_mention",
        resourceId: reply.id,
        eventData: expect.objectContaining({ channelId: general.id }),
      }),
    ]);
  });
});
