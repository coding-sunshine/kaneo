import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import {
  chatMessageTable,
  chatPresenceTable,
} from "../../apps/api/src/database/schema";
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
type Row = { type: string; resourceId: string | null };

const mention = (id: string) => `<kaneo-mention id="${id}"></kaneo-mention>`;
const refusal =
  "Only the channel owner can use @channel or @here in a channel with more than 5 members";

async function setup() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const ws = owner.workspace.id;
  const others: Seeded[] = [];
  for (let i = 0; i < 5; i++) {
    const member = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: member.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    others.push(member);
  }
  const [b, c, d, e, f] = others as [Seeded, Seeded, Seeded, Seeded, Seeded];
  const { app } = createApp();
  const channels = `/api/chat/workspace/${ws}/channels`;
  const as = (member: Seeded) => {
    mockAuthenticatedSession(member.user);
    return (path: string, init?: RequestInit) => app.request(path, init);
  };
  const createChannel = async (name: string, isPrivate = false) =>
    (await (
      await as(owner)(channels, json("POST", { name, isPrivate }))
    ).json()) as { id: string };
  const join = async (channelId: string, members: Seeded[]) => {
    for (const member of members)
      expect(
        (await as(member)(`${channels}/${channelId}/join`, json("POST")))
          .status,
      ).toBe(200);
  };
  const send = async (channelId: string, body: string, member: Seeded) => {
    const response = await as(member)(
      `${channels}/${channelId}/messages`,
      json("POST", { body }),
    );
    await settleEvents();
    return response;
  };
  const post = async (channelId: string, body: string, member = owner) => {
    const response = await send(channelId, body, member);
    expect(response.status, await response.clone().text()).toBe(200);
    return (await response.json()) as { id: string };
  };
  const inbox = async (member: Seeded) => {
    const response = await as(member)(`/api/notification?workspaceId=${ws}`);
    expect(response.status).toBe(200);
    return (await response.json()) as Row[];
  };
  const mute = (member: Seeded, channelId: string) =>
    as(member)(`${channels}/${channelId}/mute`, json("PUT", { muted: true }));
  return {
    owner,
    b,
    c,
    d,
    e,
    f,
    channels,
    as,
    createChannel,
    join,
    send,
    post,
    inbox,
    mute,
  };
}

describe("API integration: @channel and @here", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("gives each other member one Inbox row for the owner's @here, and the owner none", async () => {
    const { owner, b, c, createChannel, join, post, inbox } = await setup();
    const general = await createChannel("general");
    await join(general.id, [b, c]);

    const message = await post(general.id, "@here deploy in 10 min");

    for (const member of [b, c])
      expect(await inbox(member)).toEqual([
        expect.objectContaining({
          type: "chat_mention",
          resourceId: message.id,
        }),
      ]);
    expect(await inbox(owner)).toEqual([]);
  });

  it("gives one row, not two, to a member also mentioned by name", async () => {
    const { b, createChannel, join, post, inbox } = await setup();
    const general = await createChannel("general");
    await join(general.id, [b]);

    await post(general.id, `@channel and ${mention(b.user.id)} look`);

    expect(await inbox(b)).toHaveLength(1);
  });

  it("gives nothing to a member who muted the channel", async () => {
    const { b, c, createChannel, join, post, inbox, mute } = await setup();
    const general = await createChannel("general");
    await join(general.id, [b, c]);
    expect((await mute(c, general.id)).status).toBe(200);

    await post(general.id, "@channel heads up");

    expect(await inbox(b)).toHaveLength(1);
    expect(await inbox(c)).toEqual([]);
  });

  it("reaches only the channel's members, never readers who did not join or non-members of a private channel", async () => {
    const { b, c, d, createChannel, join, post, inbox } = await setup();
    const general = await createChannel("general");
    const leads = await createChannel("leads", true);
    await join(general.id, [b]);

    await post(general.id, "@channel public");
    await post(leads.id, "@channel private");

    expect(await inbox(b)).toHaveLength(1);
    for (const member of [c, d]) expect(await inbox(member)).toEqual([]);
  });

  it("leaves out with @here a member whose presence shows them away, not with @channel", async () => {
    const { b, c, createChannel, join, post, inbox } = await setup();
    const general = await createChannel("general");
    await join(general.id, [b, c]);
    await db.insert(chatPresenceTable).values({
      userId: c.user.id,
      lastSeenAt: new Date(Date.now() - 60 * 60 * 1000),
    });

    await post(general.id, "@here now");
    expect(await inbox(b)).toHaveLength(1);
    expect(await inbox(c)).toEqual([]);

    await post(general.id, "@channel everyone");
    expect(await inbox(c)).toHaveLength(1);
  });

  it("refuses a non-owner's @channel or @here in a channel over 5 members, with a clear message", async () => {
    const { owner, b, c, d, e, f, createChannel, join, send, inbox } =
      await setup();
    const general = await createChannel("general");
    await join(general.id, [b, c, d, e, f]);

    for (const body of ["@channel look", "hey @here"]) {
      const refused = await send(general.id, body, b);
      expect(refused.status).toBe(403);
      expect(((await refused.json()) as { message: string }).message).toBe(
        refusal,
      );
    }
    expect(await inbox(c)).toEqual([]);

    // The owner may, and plain text that only contains the word may too.
    expect((await send(general.id, "@channel look", owner)).status).toBe(200);
    expect(
      (await send(general.id, "write to ops@here.example", b)).status,
    ).toBe(200);
    expect((await send(general.id, "the channel is here", b)).status).toBe(200);
    expect(await inbox(c)).toHaveLength(1);
  });

  it("refuses a non-owner's edit that adds @channel in a channel over 5 members", async () => {
    const { b, c, d, e, f, channels, as, createChannel, join, post } =
      await setup();
    const general = await createChannel("general");
    await join(general.id, [b, c, d, e, f]);
    const message = await post(general.id, "hello", b);

    const refused = await as(b)(
      `${channels}/${general.id}/messages/${message.id}`,
      json("PATCH", { body: "@channel hello" }),
    );
    expect(refused.status).toBe(403);
    expect(((await refused.json()) as { message: string }).message).toBe(
      refusal,
    );
    const [stored] = await db
      .select({ body: chatMessageTable.body })
      .from(chatMessageTable);
    expect(stored?.body).toBe("hello");
  });

  it("lets any member use @channel in a channel of 5 members", async () => {
    const { b, c, d, e, createChannel, join, send, inbox } = await setup();
    const general = await createChannel("general");
    await join(general.id, [b, c, d, e]);

    expect((await send(general.id, "@channel lunch?", b)).status).toBe(200);
    await settleEvents();
    for (const member of [c, d, e]) expect(await inbox(member)).toHaveLength(1);
    expect(await inbox(b)).toEqual([]);
  });
});
