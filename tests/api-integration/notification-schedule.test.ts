import * as email from "@kaneo/email";
import { eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import "../../apps/api/src/notification";
import createComment from "../../apps/api/src/activity/controllers/create-comment";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

vi.mock("@kaneo/email", async (original) => ({
  ...(await original<object>()),
  sendNotificationEmail: vi.fn(async () => undefined),
}));

vi.mock("../../apps/api/src/events", async (original) => {
  const events = await original<typeof import("../../apps/api/src/events")>();
  return {
    ...events,
    publishEvent: (...args: Parameters<typeof events.publishEvent>) =>
      events.publishEvent(args[0], args[1], { waitForHandlers: true }),
  };
});

type App = ReturnType<typeof createApp>["app"];
let app: App;

const put = (cookies: string | undefined, body: unknown) =>
  app.request("/api/notification-preferences", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:5173",
      ...(cookies ? { cookie: cookies } : {}),
    },
    body: JSON.stringify(body),
  });

const get = (cookies: string) =>
  app.request("/api/notification-preferences", {
    headers: { cookie: cookies },
  });

const schedule = {
  scheduleEnabled: true,
  scheduleTimezone: "Europe/Berlin",
  scheduleDays: [1, 3, 5],
  scheduleStart: "08:30",
  scheduleEnd: "17:00",
};

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
  ({ app } = createApp());
});
afterEach(() => vi.restoreAllMocks());

describe("API integration: notification schedule settings", () => {
  it("saves and returns the caller's schedule, leaving other users alone", async () => {
    const alice = await signUpWithSession(app, {
      email: "a@example.com",
      name: "A",
    });
    const bob = await signUpWithSession(app, {
      email: "b@example.com",
      name: "B",
    });

    const saved = await put(alice.cookies, schedule);
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject(schedule);
    expect(await (await get(alice.cookies)).json()).toMatchObject(schedule);
    expect(await (await get(bob.cookies)).json()).toMatchObject({
      scheduleEnabled: false,
      scheduleTimezone: "UTC",
    });
  });

  it("rejects anonymous writes and invalid schedules", async () => {
    const alice = await signUpWithSession(app, {
      email: "a@example.com",
      name: "A",
    });

    expect((await put(undefined, schedule)).status).toBe(401);
    for (const bad of [
      { scheduleTimezone: "Not/AZone" },
      { scheduleDays: [] },
      { scheduleDays: [7] },
      { scheduleStart: "9am" },
      { scheduleStart: "18:00", scheduleEnd: "09:00" },
    ]) {
      expect((await put(alice.cookies, bad)).status).toBe(400);
    }
    expect(await (await get(alice.cookies)).json()).toMatchObject({
      scheduleEnabled: false,
    });
  });
});

describe("API integration: notification schedule delivery", () => {
  async function deliverComment(inWindow: boolean, scheduleEnabled = true) {
    const actor = await createWorkspaceMember();
    const recipient = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: actor.workspace.id,
      userId: recipient.user.id,
      joinedAt: new Date(),
    });
    const { project } = await createProjectFixture({
      workspaceId: actor.workspace.id,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Scheduled task",
        userId: recipient.user.id,
        status: "to-do",
      })
      .returning();
    const today = new Date().getUTCDay();
    await db.insert(schema.userNotificationPreferenceTable).values({
      userId: recipient.user.id,
      emailEnabled: true,
      scheduleEnabled,
      scheduleTimezone: "UTC",
      scheduleDays: inWindow
        ? [0, 1, 2, 3, 4, 5, 6]
        : [0, 1, 2, 3, 4, 5, 6].filter((day) => day !== today),
      scheduleStart: "00:00",
      scheduleEnd: "23:59",
    });
    await db.insert(schema.userNotificationWorkspaceRuleTable).values({
      userId: recipient.user.id,
      workspaceId: actor.workspace.id,
      isActive: true,
      emailEnabled: true,
      projectMode: "all",
    });
    const send = vi.mocked(email.sendNotificationEmail);
    await createComment(task.id, actor.user.id, "Please review");
    return { send, recipient };
  }

  it("sends email inside the window", async () => {
    const { send } = await deliverComment(true);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  });

  it("holds back email outside the window but keeps the inbox item", async () => {
    const { send, recipient } = await deliverComment(false);
    expect(send).not.toHaveBeenCalled();
    const rows = await db
      .select()
      .from(schema.notificationTable)
      .where(eq(schema.notificationTable.userId, recipient.user.id));
    expect(rows).toHaveLength(1);
  });

  it("ignores the window while the schedule is off", async () => {
    const { send } = await deliverComment(false, false);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  });
});
