import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import {
  chatMessageTable,
  chatReminderTable,
  userProfileTable,
} from "../../apps/api/src/database/schema";
import { settleEvents } from "../../apps/api/src/events";
import { createApp } from "../../apps/api/src/index";
import { checkChatReminders } from "../../apps/api/src/scheduler/chat-reminders";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

type Seeded = Awaited<ReturnType<typeof createWorkspaceMember>>;
type Row = { type: string; eventData: Record<string, unknown> | null };
const HOUR = 60 * 60 * 1000;

async function setup() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const member = await createWorkspaceMember();
  const reader = await createWorkspaceMember();
  const viewer = await createWorkspaceMember();
  const outsider = await createWorkspaceMember();
  const ws = owner.workspace.id;
  for (const [person, role] of [
    [member, "member"],
    [reader, "member"],
    [viewer, "viewer"],
  ] as const)
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: person.user.id,
      role,
      joinedAt: new Date(),
    });
  const { app } = createApp();
  const channels = `/api/chat/workspace/${ws}/channels`;
  const as = (person: Seeded) => {
    mockAuthenticatedSession(person.user);
    return (path: string, init?: RequestInit) => app.request(path, init);
  };
  const createChannel = async (name: string, isPrivate = false) =>
    (await (
      await as(owner)(channels, json("POST", { name, isPrivate }))
    ).json()) as { id: string };
  const general = await createChannel("general");
  const leads = await createChannel("leads", true);
  for (const person of [member, viewer])
    await as(person)(`${channels}/${general.id}/join`, json("POST"));
  await as(owner)(
    `${channels}/${leads.id}/members`,
    json("POST", { userId: member.user.id }),
  );
  const command = async (person: Seeded, channelId: string, text: string) => {
    const response = await as(person)(
      `${channels}/${channelId}/commands`,
      json("POST", { text }),
    );
    await settleEvents();
    return {
      status: response.status,
      body: (await response.json()) as Record<string, unknown>,
    };
  };
  const inbox = async (person: Seeded) =>
    (await (
      await as(person)(`/api/notification?workspaceId=${ws}`)
    ).json()) as Row[];
  const messages = () => db.select().from(chatMessageTable);
  const reminders = () => db.select().from(chatReminderTable);
  return {
    app,
    owner,
    member,
    reader,
    viewer,
    outsider,
    ws,
    channels,
    general,
    leads,
    as,
    command,
    inbox,
    messages,
    reminders,
  };
}

describe("API integration: chat slash commands", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("sets a reminder for the caller only, posts nothing, and delivers it to their Inbox once when due", async () => {
    const { member, owner, general, command, inbox, messages, reminders } =
      await setup();
    const before = Date.now();

    const result = await command(member, general.id, "/remind in 1 hour");

    expect(result.status).toBe(200);
    expect(result.body.command).toBe("remind");
    const remindAt = new Date(result.body.remindAt as string).getTime();
    expect(remindAt).toBeGreaterThanOrEqual(before + HOUR);
    expect(remindAt).toBeLessThan(Date.now() + HOUR + 1000);
    expect(await messages()).toEqual([]);
    expect(await reminders()).toEqual([
      expect.objectContaining({
        userId: member.user.id,
        channelId: general.id,
      }),
    ]);

    await checkChatReminders(new Date(before + HOUR / 2));
    expect(await inbox(member)).toEqual([]);

    await checkChatReminders(new Date(before + 2 * HOUR));
    await checkChatReminders(new Date(before + 3 * HOUR));
    expect(await inbox(member)).toEqual([
      expect.objectContaining({
        type: "chat_reminder",
        eventData: expect.objectContaining({ channelId: general.id }),
      }),
    ]);
    expect(await inbox(owner)).toEqual([]);
  });

  it("drops a due reminder once its owner can no longer read the channel", async () => {
    const { member, channels, leads, as, command, inbox } = await setup();
    expect(
      (await command(member, leads.id, "/remind in 5 minutes to sync")).status,
    ).toBe(200);
    await as(member)(`${channels}/${leads.id}/leave`, json("POST"));

    await checkChatReminders(new Date(Date.now() + HOUR));
    expect(await inbox(member)).toEqual([]);
  });

  it("sets and clears my status without posting", async () => {
    const { member, general, as, command, messages } = await setup();

    const set = await command(member, general.id, "/status away");
    expect(set).toEqual({
      status: 200,
      body: { command: "status", status: "away" },
    });
    const profile = async () =>
      (await (await as(member)("/api/user/profile")).json()) as {
        status: { text: string } | null;
      };
    expect((await profile()).status?.text).toBe("away");

    expect((await command(member, general.id, "/status")).body).toEqual({
      command: "status",
      status: null,
    });
    expect((await profile()).status).toBeNull();
    expect(await messages()).toEqual([]);
  });

  it("creates a ticket with the title and posts its card", async () => {
    const { member, ws, general, as, channels, command, messages } =
      await setup();
    const { project } = await createProjectFixture({
      workspaceId: ws,
      slug: "eng",
    });

    const result = await command(member, general.id, "/ticket Fix login");

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ command: "ticket", key: "ENG-1" });
    const [task] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.projectId, project.id));
    expect(task?.title).toBe("Fix login");
    const [posted] = await messages();
    expect(posted).toMatchObject({ userId: member.user.id, body: "ENG-1" });

    const list = (await (
      await as(member)(`${channels}/${general.id}/messages`)
    ).json()) as { mentions: { kind: string; title: string | null }[] }[];
    expect(list[0]?.mentions).toEqual([
      expect.objectContaining({ kind: "task", title: "Fix login" }),
    ]);
  });

  it("refuses /ticket when the caller can open no team, creating nothing", async () => {
    const { member, ws, general, command, messages } = await setup();
    await db
      .update(schema.projectTable)
      .set({ isPrivate: true })
      .where(
        eq(
          schema.projectTable.id,
          (await createProjectFixture({ workspaceId: ws })).project.id,
        ),
      );

    const result = await command(member, general.id, "/ticket Fix login");

    expect(result.status).toBe(409);
    expect(await db.select().from(schema.taskTable)).toEqual([]);
    expect(await messages()).toEqual([]);
  });

  it("refuses /status over an API key, which cannot change a profile", async () => {
    const { app, member, channels, general, messages } = await setup();
    const key = `test_${randomUUID()}`;
    await db.insert(schema.apikeyTable).values({
      referenceId: member.user.id,
      userId: member.user.id,
      key: createHash("sha256").update(key).digest("base64url"),
      enabled: true,
      rateLimitEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockAnonymousSession();

    const response = await app.request(`${channels}/${general.id}/commands`, {
      ...json("POST", { text: "/status away" }),
      headers: { "content-type": "application/json", "x-api-key": key },
    });

    expect(response.status).toBe(403);
    expect(((await response.json()) as { message: string }).message).toBe(
      "A user session is required",
    );
    const [profile] = await db
      .select()
      .from(userProfileTable)
      .where(eq(userProfileTable.userId, member.user.id));
    expect(profile?.statusText ?? null).toBeNull();
    expect(await messages()).toEqual([]);
  });

  it("refuses /ticket to someone who may post but not create tickets", async () => {
    const { ws, channels, general, as, command, messages } = await setup();
    await createProjectFixture({ workspaceId: ws, slug: "eng" });
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: ws,
      role: "poster",
      permission: JSON.stringify({
        workspace: ["read"],
        task: ["read", "update"],
      }),
    });
    const poster = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: poster.user.id,
      role: "poster",
      joinedAt: new Date(),
    });
    expect(
      (await as(poster)(`${channels}/${general.id}/join`, json("POST"))).status,
    ).toBe(200);

    const result = await command(poster, general.id, "/ticket Fix login");

    expect(result).toMatchObject({
      status: 403,
      body: { message: "Missing permission to create tickets" },
    });
    expect(await db.select().from(schema.taskTable)).toEqual([]);
    expect(await messages()).toEqual([]);
  });

  it("refuses an unknown command or a malformed one, storing nothing", async () => {
    const { member, general, command, messages, reminders } = await setup();

    for (const text of ["/deploy now", "/remind tomorrow", "/ticket"]) {
      const result = await command(member, general.id, text);
      expect(result.status).toBe(400);
    }
    expect(await messages()).toEqual([]);
    expect(await reminders()).toEqual([]);
  });

  it("lets only members who may post run commands", async () => {
    const {
      owner,
      member,
      reader,
      viewer,
      outsider,
      channels,
      general,
      leads,
      as,
      command,
      reminders,
    } = await setup();

    expect((await command(reader, leads.id, "/remind in 1 hour")).status).toBe(
      404,
    );
    expect(
      (await command(outsider, general.id, "/remind in 1 hour")).status,
    ).toBe(404);
    expect(
      (await command(reader, general.id, "/remind in 1 hour")).status,
    ).toBe(403);
    expect(
      (await command(viewer, general.id, "/remind in 1 hour")).status,
    ).toBe(403);
    await as(owner)(
      `${channels}/${general.id}`,
      json("PATCH", { archived: true }),
    );
    expect(
      (await command(member, general.id, "/remind in 1 hour")).status,
    ).toBe(409);
    expect(await reminders()).toEqual([]);
  });
});
