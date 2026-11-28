import * as email from "@kaneo/email";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { chatPresenceTable } from "../../apps/api/src/database/schema";
import { settleEvents } from "../../apps/api/src/events";
import { createApp } from "../../apps/api/src/index";
import { sendChatEmailFallbacks } from "../../apps/api/src/scheduler/chat-email-fallback";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

vi.mock("@kaneo/email", async (original) => ({
  ...(await original<object>()),
  isSmtpConfigured: () => true,
  sendNotificationEmail: vi.fn(async () => ({ success: true })),
}));

const sent = vi.mocked(email.sendNotificationEmail);

const json = (method: string, body?: unknown) => ({
  method,
  headers: {
    "content-type": "application/json",
    origin: "http://localhost:5173",
  },
  body: body === undefined ? undefined : JSON.stringify(body),
});

type Seeded = Awaited<ReturnType<typeof createWorkspaceMember>>;

const mention = (id: string) => `<kaneo-mention id="${id}"></kaneo-mention>`;
const minutes = (count: number) => count * 60_000;
// A Monday morning in UTC; every row and every run is pinned around it.
const start = new Date("2026-01-05T10:00:00.000Z");
const at = (offsetMinutes: number) =>
  new Date(start.getTime() + minutes(offsetMinutes));

// Email for chat goes out only to people who turned email on.
async function setup({ emailOn = true } = {}) {
  const author = await createWorkspaceMember({
    role: "owner",
    userName: "Author",
  });
  const reader = await createWorkspaceMember({ userName: "Reader" });
  const ws = author.workspace.id;
  await db.insert(schema.workspaceUserTable).values({
    workspaceId: ws,
    userId: reader.user.id,
    role: "member",
    joinedAt: new Date(),
  });
  const { app } = createApp();
  const channels = `/api/chat/workspace/${ws}/channels`;
  const as = (member: Seeded) => {
    mockAuthenticatedSession(member.user);
    return (path: string, init?: RequestInit) => app.request(path, init);
  };
  const direct = (await (
    await as(author)(
      `/api/chat/workspace/${ws}/direct-messages`,
      json("POST", { userIds: [reader.user.id] }),
    )
  ).json()) as { id: string };
  // Posts as `member` and pins the Inbox row it made to `offset` minutes.
  const post = async (
    channelId: string,
    body: string,
    offset = 0,
    member: Seeded = author,
  ) => {
    const response = await as(member)(
      `${channels}/${channelId}/messages`,
      json("POST", { body }),
    );
    expect(response.status, await response.clone().text()).toBe(200);
    await settleEvents();
    const message = (await response.json()) as { id: string };
    await db
      .update(schema.notificationTable)
      .set({ createdAt: at(offset) })
      .where(eq(schema.notificationTable.resourceId, message.id));
    return message;
  };
  const preferences = (member: Seeded, body: Record<string, unknown>) =>
    as(member)("/api/notification-preferences", json("PUT", body));
  if (emailOn)
    expect((await preferences(reader, { emailEnabled: true })).status).toBe(
      200,
    );
  return { author, reader, ws, app, channels, as, direct, post, preferences };
}

const emailsTo = (member: Seeded) =>
  sent.mock.calls.filter(([to]) => to === member.user.email);

describe("API integration: email for unread chat", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    vi.clearAllMocks();
  });

  it("emails a direct message left unread past the delay, with a link, at most once an hour", async () => {
    const { reader, ws, direct, post } = await setup();
    const first = await post(direct.id, "can you check the release notes?");

    await sendChatEmailFallbacks(at(5));
    expect(sent).not.toHaveBeenCalled();

    await sendChatEmailFallbacks(at(11));
    expect(emailsTo(reader)).toHaveLength(1);
    const [, , data] = emailsTo(reader)[0] ?? [];
    expect(data?.message).toContain("Author");
    expect(data?.message).toContain("can you check the release notes?");
    expect(data?.actionUrl).toBe(
      `http://localhost:5173/dashboard/workspace/${ws}/channels/${direct.id}?messageId=${first.id}`,
    );

    // The same message is never emailed twice.
    await sendChatEmailFallbacks(at(20));
    expect(sent).toHaveBeenCalledTimes(1);

    // A newer one waits for the hour to pass, then comes alone.
    await post(direct.id, "also the changelog", 15);
    await sendChatEmailFallbacks(at(40));
    expect(sent).toHaveBeenCalledTimes(1);
    await sendChatEmailFallbacks(at(72));
    expect(sent).toHaveBeenCalledTimes(2);
    const [, , second] = sent.mock.calls[1] ?? [];
    expect(second?.message).toContain("also the changelog");
    expect(second?.message).not.toContain("release notes");
  });

  it("sends nothing for a message read in the channel, or to someone active", async () => {
    const { reader, ws, direct, post, as } = await setup();
    await post(direct.id, "seen already");
    await as(reader)(
      `/api/chat/workspace/${ws}/channels/${direct.id}/read`,
      json("POST"),
    );
    await sendChatEmailFallbacks(at(30));
    expect(sent).not.toHaveBeenCalled();

    await post(direct.id, "still here?", 30);
    await db
      .insert(chatPresenceTable)
      .values({ userId: reader.user.id, lastSeenAt: at(55) });
    await sendChatEmailFallbacks(at(60));
    expect(sent).not.toHaveBeenCalled();
    await sendChatEmailFallbacks(at(70));
    expect(emailsTo(reader)).toHaveLength(1);
  });

  it("adds nothing for a muted channel, even one muted after the message", async () => {
    const { author, reader, channels, as, direct, post } = await setup();
    const general = (await (
      await as(author)(channels, json("POST", { name: "general" }))
    ).json()) as { id: string };
    await as(reader)(`${channels}/${general.id}/join`, json("POST"));
    await as(reader)(
      `${channels}/${general.id}/mute`,
      json("PUT", { muted: true }),
    );
    await post(general.id, `ping ${mention(reader.user.id)}`);
    await post(direct.id, "muted later");
    await as(reader)(
      `${channels}/${direct.id}/mute`,
      json("PUT", { muted: true }),
    );
    await sendChatEmailFallbacks(at(30));
    expect(sent).not.toHaveBeenCalled();
  });

  it("holds the email through quiet hours lasting days, and sends it once they end", async () => {
    const { reader, direct, post, preferences } = await setup();
    const saved = await preferences(reader, {
      scheduleEnabled: true,
      scheduleTimezone: "UTC",
      scheduleDays: [3],
      scheduleStart: "12:00",
      scheduleEnd: "18:00",
    });
    expect(saved.status).toBe(200);
    await post(direct.id, "before hours");

    await sendChatEmailFallbacks(at(30));
    await sendChatEmailFallbacks(at(24 * 60 + 150));
    expect(sent).not.toHaveBeenCalled();
    // Wednesday at 12:01, two days later.
    const nextWindow = 2 * 24 * 60 + 121;
    await sendChatEmailFallbacks(at(nextWindow));
    expect(emailsTo(reader)).toHaveLength(1);
    expect(emailsTo(reader)[0]?.[2]?.message).toContain("before hours");
  });

  it("sends none once 'Email for unread chat' is off, and that switch is the caller's own", async () => {
    const { author, reader, direct, post, preferences, as } = await setup();
    const off = await preferences(reader, { chatEmailEnabled: false });
    expect(off.status).toBe(200);
    expect(await off.json()).toMatchObject({ chatEmailEnabled: false });
    const authorView = await (
      await as(author)("/api/notification-preferences")
    ).json();
    expect(authorView).toMatchObject({ chatEmailEnabled: true });

    await post(direct.id, "anyone?");
    await sendChatEmailFallbacks(at(30));
    expect(sent).not.toHaveBeenCalled();
  });

  it("sends none to someone who never turned email on, with or without a preference row", async () => {
    const { reader, direct, post, preferences } = await setup({
      emailOn: false,
    });
    await post(direct.id, "no row yet");
    await sendChatEmailFallbacks(at(30));
    expect(sent).not.toHaveBeenCalled();

    // A saved row with email off, chat email left on, still sends none.
    const saved = await preferences(reader, { chatEmailEnabled: true });
    expect(await saved.json()).toMatchObject({
      emailEnabled: false,
      chatEmailEnabled: true,
    });
    await sendChatEmailFallbacks(at(31));
    expect(sent).not.toHaveBeenCalled();
    expect(emailsTo(reader)).toHaveLength(0);
  });

  it("reads at most the run's cap of rows, and leaves the rest for a later run", async () => {
    const { reader, direct, post } = await setup();
    await post(direct.id, "oldest first", 0);
    await post(direct.id, "then this one", 1);

    await sendChatEmailFallbacks(at(30), 1);
    expect(emailsTo(reader)).toHaveLength(1);
    expect(emailsTo(reader)[0]?.[2]?.message).toContain("oldest first");
    expect(emailsTo(reader)[0]?.[2]?.message).not.toContain("then this one");

    await sendChatEmailFallbacks(at(95), 1);
    expect(emailsTo(reader)).toHaveLength(2);
    expect(emailsTo(reader)[1]?.[2]?.message).toContain("then this one");
  });

  it("sends nothing about a channel the person can no longer read", async () => {
    const { reader, ws, direct, post } = await setup();
    await post(direct.id, "before you left");
    await db
      .delete(schema.workspaceUserTable)
      .where(
        and(
          eq(schema.workspaceUserTable.workspaceId, ws),
          eq(schema.workspaceUserTable.userId, reader.user.id),
        ),
      );
    await sendChatEmailFallbacks(at(30));
    expect(sent).not.toHaveBeenCalled();
  });

  it("sends none when the email fails to go out, and retries on the next run", async () => {
    const { reader, direct, post } = await setup();
    await post(direct.id, "retry me");
    sent.mockResolvedValueOnce({
      success: false,
      reason: "SMTP_NOT_CONFIGURED",
    } as never);
    await sendChatEmailFallbacks(at(30));
    await sendChatEmailFallbacks(at(31));
    expect(emailsTo(reader)).toHaveLength(2);
    expect(emailsTo(reader)[1]?.[2]?.message).toContain("retry me");
  });
});
