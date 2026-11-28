import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { chatChannelMemberTable } from "../../apps/api/src/database/schema";
import { settleEvents } from "../../apps/api/src/events";
import { createApp } from "../../apps/api/src/index";
import { checkChatReminders } from "../../apps/api/src/scheduler/chat-reminders";
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

const DAY = 24 * 60 * 60_000;

async function setup() {
  const owner = await createWorkspaceMember({
    role: "owner",
    userName: "Owner",
  });
  const other = await createWorkspaceMember({ userName: "Other" });
  const outsider = await createWorkspaceMember();
  const ws = owner.workspace.id;
  await db.insert(schema.workspaceUserTable).values({
    workspaceId: ws,
    userId: other.user.id,
    role: "member",
    joinedAt: new Date(),
  });
  const { app } = createApp();
  const channels = `/api/chat/workspace/${ws}/channels`;
  const saved = `/api/chat/workspace/${ws}/saved-messages`;
  const as = (member: Seeded) => {
    mockAuthenticatedSession(member.user);
    return (path: string, init?: RequestInit) => app.request(path, init);
  };
  const createChannel = async (name: string, isPrivate = false) =>
    (await (
      await as(owner)(channels, json("POST", { name, isPrivate }))
    ).json()) as { id: string };
  const general = await createChannel("general");
  const post = async (channelId: string, body: string) => {
    const response = await as(owner)(
      `${channels}/${channelId}/messages`,
      json("POST", { body }),
    );
    expect(response.status, await response.clone().text()).toBe(200);
    await settleEvents();
    return (await response.json()) as { id: string };
  };
  const messagePath = (channelId: string, messageId: string) =>
    `${channels}/${channelId}/messages/${messageId}`;
  const remind = (
    member: Seeded,
    channelId: string,
    messageId: string,
    remindAt: Date,
  ) =>
    as(member)(
      `${messagePath(channelId, messageId)}/reminder`,
      json("POST", { remindAt: remindAt.toISOString() }),
    );
  const save = (
    member: Seeded,
    channelId: string,
    messageId: string,
    value: boolean,
  ) =>
    as(member)(
      `${messagePath(channelId, messageId)}/saved`,
      json("PUT", { saved: value }),
    );
  const listSaved = async (member: Seeded) => {
    const response = await as(member)(saved);
    expect(response.status).toBe(200);
    return (await response.json()) as Array<{ id: string; body: string }>;
  };
  const inbox = async (member: Seeded) =>
    (await (
      await as(member)(`/api/notification?workspaceId=${ws}`)
    ).json()) as Row[];
  return {
    owner,
    other,
    outsider,
    ws,
    channels,
    saved,
    as,
    general,
    createChannel,
    post,
    remind,
    save,
    listSaved,
    inbox,
  };
}

describe("API integration: remind me about a message", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("puts the message in my Inbox, with a link, once the time comes, and nobody else's", async () => {
    const { owner, other, ws, general, post, remind, inbox } = await setup();
    const message = await post(general.id, "ship the release notes");
    const remindAt = new Date(Date.now() + DAY);

    const response = await remind(owner, general.id, message.id, remindAt);
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({
      messageId: message.id,
      remindAt: remindAt.toISOString(),
    });

    await checkChatReminders(new Date(remindAt.getTime() - 60_000));
    expect(await inbox(owner)).toEqual([]);

    await checkChatReminders(new Date(remindAt.getTime() + 60_000));
    const rows = await inbox(owner);
    expect(rows).toEqual([
      expect.objectContaining({
        type: "chat_reminder",
        resourceType: "chat_message",
        resourceId: message.id,
        eventData: expect.objectContaining({
          workspaceId: ws,
          channelId: general.id,
          messageId: message.id,
          messagePreview: "ship the release notes",
        }),
      }),
    ]);
    expect(await inbox(other)).toEqual([]);
  });

  it("still reminds me, pointing at the channel, when the message was deleted", async () => {
    const { owner, ws, channels, general, post, remind, inbox, as } =
      await setup();
    const message = await post(general.id, "soon gone");
    const remindAt = new Date(Date.now() + DAY);
    await remind(owner, general.id, message.id, remindAt);
    await as(owner)(
      `${channels}/${general.id}/messages/${message.id}`,
      json("DELETE"),
    );
    await checkChatReminders(new Date(remindAt.getTime() + 60_000));
    expect(await inbox(owner)).toEqual([
      expect.objectContaining({
        type: "chat_reminder",
        resourceType: "workspace",
        resourceId: ws,
        eventData: expect.objectContaining({ channelId: general.id }),
      }),
    ]);
  });

  it("refuses a time in the past or over a year ahead, and a message I cannot read", async () => {
    const { owner, other, outsider, general, createChannel, post, remind } =
      await setup();
    const message = await post(general.id, "hello");
    for (const when of [
      new Date(Date.now() - 60_000),
      new Date(Date.now() + 400 * DAY),
    ])
      expect((await remind(owner, general.id, message.id, when)).status).toBe(
        400,
      );

    const leads = await createChannel("leads", true);
    const secret = await post(leads.id, "private plan");
    const later = new Date(Date.now() + DAY);
    expect((await remind(other, leads.id, secret.id, later)).status).toBe(404);
    // A message id from another channel is missing here too.
    expect((await remind(other, general.id, secret.id, later)).status).toBe(
      404,
    );
    // Someone outside the workspace learns nothing about it.
    expect((await remind(outsider, general.id, message.id, later)).status).toBe(
      404,
    );
  });

  it("sends nothing about a private message once I can no longer read it", async () => {
    const { owner, other, createChannel, post, remind, inbox, as, channels } =
      await setup();
    const leads = await createChannel("leads", true);
    await as(owner)(
      `${channels}/${leads.id}/members`,
      json("POST", { userId: other.user.id }),
    );
    const message = await post(leads.id, "private plan");
    const remindAt = new Date(Date.now() + DAY);
    expect((await remind(other, leads.id, message.id, remindAt)).status).toBe(
      200,
    );
    await db
      .delete(chatChannelMemberTable)
      .where(
        and(
          eq(chatChannelMemberTable.channelId, leads.id),
          eq(chatChannelMemberTable.userId, other.user.id),
        ),
      );
    await checkChatReminders(new Date(remindAt.getTime() + 60_000));
    expect(await inbox(other)).toEqual([]);
  });
});

describe("API integration: saved messages", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("lists what I saved, newest first; removing it leaves the message in the channel", async () => {
    const { owner, channels, general, post, save, listSaved, as } =
      await setup();
    const first = await post(general.id, "first");
    const second = await post(general.id, "second");

    expect((await save(owner, general.id, first.id, true)).status).toBe(200);
    expect((await save(owner, general.id, second.id, true)).status).toBe(200);
    // Saving twice keeps one entry.
    expect((await save(owner, general.id, second.id, true)).status).toBe(200);
    expect((await listSaved(owner)).map((m) => m.body)).toEqual([
      "second",
      "first",
    ]);

    const removed = await save(owner, general.id, first.id, false);
    expect(removed.status).toBe(200);
    expect(await removed.json()).toEqual({
      messageId: first.id,
      saved: false,
    });
    expect((await listSaved(owner)).map((m) => m.id)).toEqual([second.id]);
    const messages = (await (
      await as(owner)(`${channels}/${general.id}/messages`)
    ).json()) as Array<{ id: string }>;
    expect(messages.map((m) => m.id)).toContain(first.id);
  });

  it("keeps my saved list to me", async () => {
    const {
      owner,
      other,
      outsider,
      general,
      post,
      save,
      listSaved,
      saved,
      as,
    } = await setup();
    const message = await post(general.id, "keep this");
    await save(owner, general.id, message.id, true);

    expect(await listSaved(other)).toEqual([]);
    // Another person unsaving it changes only their own list.
    expect((await save(other, general.id, message.id, false)).status).toBe(200);
    expect((await listSaved(owner)).map((m) => m.id)).toEqual([message.id]);
    expect((await as(outsider)(saved)).status).toBe(404);
    expect((await save(outsider, general.id, message.id, true)).status).toBe(
      404,
    );
  });

  it("drops a saved message from a channel I can no longer read, and refuses one I cannot read", async () => {
    const { owner, other, channels, createChannel, post, save, listSaved, as } =
      await setup();
    const leads = await createChannel("leads", true);
    await as(owner)(
      `${channels}/${leads.id}/members`,
      json("POST", { userId: other.user.id }),
    );
    const message = await post(leads.id, "private plan");
    expect((await save(other, leads.id, message.id, true)).status).toBe(200);
    expect(await listSaved(other)).toHaveLength(1);

    await db
      .delete(chatChannelMemberTable)
      .where(
        and(
          eq(chatChannelMemberTable.channelId, leads.id),
          eq(chatChannelMemberTable.userId, other.user.id),
        ),
      );
    expect(await listSaved(other)).toEqual([]);
    expect((await save(other, leads.id, message.id, true)).status).toBe(404);
    expect(await listSaved(owner)).toEqual([]);
  });
});
