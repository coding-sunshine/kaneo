import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { publishEvent, settleEvents } from "../../apps/api/src/events";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createFakeCalendarProviders } from "./helpers/fake-calendar-providers";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const { app } = createApp();
const BASE = "/api/calendar-sync";
let fake = createFakeCalendarProviders();

type Member = Awaited<ReturnType<typeof createWorkspaceMember>>;

const configure = () => {
  process.env.GOOGLE_CALENDAR_CLIENT_ID = "google-client";
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "google-secret";
  process.env.MICROSOFT_CALENDAR_CLIENT_ID = "microsoft-client";
  process.env.MICROSOFT_CALENDAR_CLIENT_SECRET = "microsoft-secret";
};

const unconfigure = () => {
  delete process.env.GOOGLE_CALENDAR_CLIENT_ID;
  delete process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  delete process.env.MICROSOFT_CALENDAR_CLIENT_ID;
  delete process.env.MICROSOFT_CALENDAR_CLIENT_SECRET;
};

beforeEach(async () => {
  await resetTestDatabase();
  vi.restoreAllMocks();
  fake = createFakeCalendarProviders();
  vi.stubGlobal("fetch", fake.fetch);
  configure();
});

afterEach(() => {
  vi.unstubAllGlobals();
  unconfigure();
});

async function signedIn(member?: Member) {
  const context = member ?? (await createWorkspaceMember());
  mockAuthenticatedSession(context.user);
  return context;
}

async function connect(
  provider: "google" | "microsoft",
  email: string,
  timeZone = "UTC",
) {
  const start = await app.request(
    `${BASE}/connect/${provider}?returnTo=/dashboard/settings/account/calendar&timeZone=${encodeURIComponent(timeZone)}`,
  );
  const authorize = new URL(start.headers.get("location") ?? "");
  const cookie = (start.headers.get("set-cookie") ?? "").split(";")[0];
  const response = await app.request(
    `${BASE}/callback/${provider}?code=code:${email}&state=${authorize.searchParams.get("state")}`,
    { headers: { cookie } },
  );
  return { start, authorize, response };
}

async function createTask(
  member: Member,
  body: Record<string, unknown>,
  projectId?: string,
) {
  const id =
    projectId ??
    (await createProjectFixture({ workspaceId: member.workspace.id })).project
      .id;
  const response = await app.request(`/api/task/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Ship the release notes",
      description: "",
      status: "to-do",
      priority: "no-priority",
      userId: member.user.id,
      ...body,
    }),
  });
  expect(response.status, await response.clone().text()).toBe(200);
  await settleEvents();
  return { task: (await response.json()) as { id: string }, projectId: id };
}

describe("configuration", () => {
  it("reports each provider as not configured and refuses to connect without keys", async () => {
    unconfigure();
    await signedIn();
    const status = await app.request(`${BASE}/status`);
    expect(await status.json()).toEqual({
      providers: [
        { provider: "google", state: "not_configured", email: null },
        { provider: "microsoft", state: "not_configured", email: null },
      ],
    });
    expect((await app.request(`${BASE}/connect/google`)).status).toBe(404);
  });
});

describe("access", () => {
  it("requires a signed-in session", async () => {
    mockAnonymousSession();
    expect((await app.request(`${BASE}/status`)).status).toBe(401);
    expect(
      (
        await app.request(
          `${BASE}/events?from=2026-11-01T00:00:00Z&to=2026-12-01T00:00:00Z`,
        )
      ).status,
    ).toBe(401);
  });

  it("refuses API keys, since the calendar acts as the person", async () => {
    const { user } = await createWorkspaceMember();
    mockAnonymousSession();
    const key = `test_${randomUUID()}`;
    await db.insert(schema.apikeyTable).values({
      referenceId: user.id,
      userId: user.id,
      key: createHash("sha256").update(key).digest("base64url"),
      enabled: true,
      rateLimitEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const response = await app.request(`${BASE}/status`, {
      headers: { "x-api-key": key },
    });
    expect(response.status).toBe(403);
  });

  it("rejects a callback whose state did not start in this browser", async () => {
    await signedIn();
    const response = await app.request(
      `${BASE}/callback/google?code=code:a@example.com&state=forged`,
    );
    expect(response.status).toBe(400);
    expect(await db.select().from(schema.calendarConnectionTable)).toEqual([]);
  });

  it("never reads another person's calendar", async () => {
    await signedIn();
    await connect("google", "owner@example.com");
    fake.seed("google", "owner@example.com", {
      summary: "Private dentist visit",
      start: { dateTime: "2026-11-10T09:00:00Z" },
      end: { dateTime: "2026-11-10T10:00:00Z" },
    });
    await signedIn();
    const response = await app.request(
      `${BASE}/events?from=2026-11-01T00:00:00Z&to=2026-12-01T00:00:00Z`,
    );
    expect(await response.json()).toEqual({ events: [], unavailable: [] });
  });
});

describe("connect", () => {
  it("asks Google for offline calendar access and returns to the web app", async () => {
    await signedIn();
    const { start, authorize, response } = await connect(
      "google",
      "person@example.com",
      "Australia/Sydney",
    );
    expect(start.status).toBe(302);
    expect(authorize.origin + authorize.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(authorize.searchParams.get("client_id")).toBe("google-client");
    expect(authorize.searchParams.get("access_type")).toBe("offline");
    expect(authorize.searchParams.get("prompt")).toBe("consent");
    expect(authorize.searchParams.get("response_type")).toBe("code");
    expect(authorize.searchParams.get("scope")).toContain(
      "https://www.googleapis.com/auth/calendar.events",
    );
    expect(authorize.searchParams.get("redirect_uri")).toMatch(
      /\/api\/calendar-sync\/callback\/google$/,
    );
    expect(start.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toMatch(
      /\/dashboard\/settings\/account\/calendar$/,
    );

    const status = await (await app.request(`${BASE}/status`)).json();
    expect(status.providers[0]).toEqual({
      provider: "google",
      state: "connected",
      email: "person@example.com",
    });
    expect(JSON.stringify(status)).not.toContain("access");
    const [row] = await db.select().from(schema.calendarConnectionTable);
    expect(row).toMatchObject({
      provider: "google",
      accountEmail: "person@example.com",
      timeZone: "Australia/Sydney",
    });
  });

  it("asks Microsoft for offline calendar access", async () => {
    await signedIn();
    const { authorize, response } = await connect(
      "microsoft",
      "person@example.com",
    );
    expect(authorize.origin + authorize.pathname).toBe(
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    );
    const scope = authorize.searchParams.get("scope") ?? "";
    expect(scope).toContain("offline_access");
    expect(scope).toContain("Calendars.ReadWrite");
    expect(response.status).toBe(302);
  });

  it("disconnects and removes the due-date events it wrote", async () => {
    const member = await signedIn();
    await connect("google", "person@example.com");
    await createTask(member, { dueDate: "2026-12-01T00:00:00.000Z" });
    expect(fake.events("google", "person@example.com")).toHaveLength(1);

    const response = await app.request(`${BASE}/connection/google`, {
      method: "DELETE",
    });
    expect(response.status).toBe(200);
    expect(fake.events("google", "person@example.com")).toHaveLength(0);
    expect(await db.select().from(schema.calendarConnectionTable)).toEqual([]);
    expect(await db.select().from(schema.calendarTaskEventTable)).toEqual([]);
  });
});

describe("external events", () => {
  it("lists events from both calendars, paged, with meeting links", async () => {
    await signedIn();
    await connect("google", "person@example.com");
    await connect("microsoft", "person@example.com");
    fake.pageSize.google = 1;
    fake.pageSize.microsoft = 1;
    fake.seed("google", "person@example.com", {
      summary: "Design review",
      status: "confirmed",
      start: { dateTime: "2026-11-10T09:00:00Z" },
      end: { dateTime: "2026-11-10T10:00:00Z" },
      htmlLink: "https://calendar.google.com/event?eid=a",
      hangoutLink: "https://meet.google.com/abc-defg-hij",
    });
    fake.seed("google", "person@example.com", {
      summary: "Team offsite",
      status: "confirmed",
      start: { date: "2026-11-12" },
      end: { date: "2026-11-14" },
      htmlLink: "https://calendar.google.com/event?eid=b",
    });
    fake.seed("google", "person@example.com", {
      summary: "Cancelled sync",
      status: "cancelled",
      start: { dateTime: "2026-11-11T09:00:00Z" },
      end: { dateTime: "2026-11-11T10:00:00Z" },
    });
    fake.seed("microsoft", "person@example.com", {
      subject: "Customer call",
      isAllDay: false,
      isCancelled: false,
      start: { dateTime: "2026-11-20T15:00:00.0000000", timeZone: "UTC" },
      end: { dateTime: "2026-11-20T15:30:00.0000000", timeZone: "UTC" },
      webLink: "https://outlook.office.com/calendar/item/x",
      onlineMeeting: { joinUrl: "https://teams.microsoft.com/l/meetup-join/x" },
    });
    fake.seed("microsoft", "person@example.com", {
      subject: "Planning day",
      isAllDay: true,
      isCancelled: false,
      start: { dateTime: "2026-11-25T00:00:00.0000000", timeZone: "UTC" },
      end: { dateTime: "2026-11-26T00:00:00.0000000", timeZone: "UTC" },
      webLink: "https://outlook.office.com/calendar/item/y",
      onlineMeeting: null,
    });

    const response = await app.request(
      `${BASE}/events?from=2026-11-01T00:00:00Z&to=2026-12-01T00:00:00Z`,
    );
    expect(response.status).toBe(200);
    const { events, unavailable } = await response.json();
    expect(unavailable).toEqual([]);
    expect(events).toEqual([
      expect.objectContaining({
        provider: "google",
        title: "Design review",
        start: "2026-11-10T09:00:00.000Z",
        end: "2026-11-10T10:00:00.000Z",
        allDay: false,
        meetingUrl: "https://meet.google.com/abc-defg-hij",
        url: "https://calendar.google.com/event?eid=a",
      }),
      // All-day ends are exclusive on the wire, inclusive here.
      expect.objectContaining({
        title: "Team offsite",
        start: "2026-11-12",
        end: "2026-11-13",
        allDay: true,
        meetingUrl: null,
      }),
      expect.objectContaining({
        provider: "microsoft",
        title: "Customer call",
        start: "2026-11-20T15:00:00.000Z",
        end: "2026-11-20T15:30:00.000Z",
        meetingUrl: "https://teams.microsoft.com/l/meetup-join/x",
      }),
      expect.objectContaining({
        title: "Planning day",
        start: "2026-11-25",
        end: "2026-11-25",
        allDay: true,
      }),
    ]);
  });

  it("refreshes an expired token and keeps Google's refresh token", async () => {
    const member = await signedIn();
    await connect("google", "person@example.com");
    const refreshToken = fake.refreshToken("google", "person@example.com");
    await db
      .update(schema.calendarConnectionTable)
      .set({ accessTokenExpiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.calendarConnectionTable.userId, member.user.id));

    const response = await app.request(
      `${BASE}/events?from=2026-11-01T00:00:00Z&to=2026-12-01T00:00:00Z`,
    );
    expect(response.status).toBe(200);
    const [row] = await db.select().from(schema.calendarConnectionTable);
    expect(row.refreshToken).toBe(refreshToken);
    expect(row.accessTokenExpiresAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it("marks a revoked connection for reconnecting", async () => {
    await signedIn();
    await connect("google", "person@example.com");
    fake.revoke("google", "person@example.com");
    const response = await app.request(
      `${BASE}/events?from=2026-11-01T00:00:00Z&to=2026-12-01T00:00:00Z`,
    );
    expect(await response.json()).toEqual({
      events: [],
      unavailable: ["google"],
    });
    const status = await (await app.request(`${BASE}/status`)).json();
    expect(status.providers[0].state).toBe("needs_reconnect");
  });

  it("keeps the connection when a refresh fails for a server-side reason", async () => {
    const member = await signedIn();
    await connect("google", "person@example.com");
    await db
      .update(schema.calendarConnectionTable)
      .set({ accessTokenExpiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.calendarConnectionTable.userId, member.user.id));
    // A rotated client secret is the server's problem, not the person's.
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "rotated-secret";
    const response = await app.request(
      `${BASE}/events?from=2026-11-01T00:00:00Z&to=2026-12-01T00:00:00Z`,
    );
    expect(await response.json()).toEqual({
      events: [],
      unavailable: ["google"],
    });
    configure();
    const status = await (await app.request(`${BASE}/status`)).json();
    expect(status.providers[0].state).toBe("connected");
  });

  it("rejects a range longer than the calendar view needs", async () => {
    await signedIn();
    const response = await app.request(
      `${BASE}/events?from=2026-01-01T00:00:00Z&to=2026-12-01T00:00:00Z`,
    );
    expect(response.status).toBe(400);
  });
});

describe("creating events", () => {
  it("creates a Google event with a generated Meet link", async () => {
    await signedIn();
    await connect("google", "person@example.com");
    const response = await app.request(`${BASE}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "google",
        title: "Sprint kickoff",
        allDay: false,
        start: "2026-11-30T23:00:00.000Z",
        end: "2026-11-30T23:30:00.000Z",
        addMeeting: true,
      }),
    });
    expect(response.status).toBe(201);
    const created = await response.json();
    expect(created).toMatchObject({
      provider: "google",
      title: "Sprint kickoff",
      start: "2026-11-30T23:00:00.000Z",
      meetingUrl: expect.stringMatching(/^https:\/\/meet\.google\.com\//),
    });
    const [stored] = fake.events("google", "person@example.com");
    expect(stored).toMatchObject({
      summary: "Sprint kickoff",
      hangoutLink: created.meetingUrl,
    });
  });

  it("creates a Teams meeting in Outlook", async () => {
    await signedIn();
    await connect("microsoft", "person@example.com");
    const response = await app.request(`${BASE}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "microsoft",
        title: "Customer demo",
        allDay: false,
        start: "2026-12-02T01:00:00.000Z",
        end: "2026-12-02T02:00:00.000Z",
        addMeeting: true,
      }),
    });
    expect(response.status).toBe(201);
    expect((await response.json()).meetingUrl).toMatch(
      /^https:\/\/teams\.microsoft\.com\//,
    );
    const [stored] = fake.events("microsoft", "person@example.com");
    expect(stored).toMatchObject({
      subject: "Customer demo",
      isOnlineMeeting: true,
      onlineMeetingProvider: "teamsForBusiness",
      start: { dateTime: "2026-12-02T01:00:00.000", timeZone: "UTC" },
    });
  });

  it("keeps a pasted meeting link on the event", async () => {
    await signedIn();
    await connect("microsoft", "person@example.com");
    const response = await app.request(`${BASE}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "microsoft",
        title: "Vendor sync",
        allDay: true,
        start: "2026-12-03",
        end: "2026-12-03",
        meetingUrl: "https://meet.example.com/room-1",
      }),
    });
    expect(response.status).toBe(201);
    expect((await response.json()).meetingUrl).toBe(
      "https://meet.example.com/room-1",
    );
    const [stored] = fake.events("microsoft", "person@example.com");
    expect(stored).toMatchObject({
      isAllDay: true,
      start: { dateTime: "2026-12-03T00:00:00" },
      end: { dateTime: "2026-12-04T00:00:00" },
      location: { displayName: "https://meet.example.com/room-1" },
    });
  });

  it("refuses a calendar that is not connected", async () => {
    await signedIn();
    const response = await app.request(`${BASE}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "google",
        title: "Nope",
        allDay: true,
        start: "2026-12-03",
        end: "2026-12-03",
      }),
    });
    expect(response.status).toBe(409);
  });
});

describe("task due dates", () => {
  it("writes an assigned task's due date as an all-day event on the local day", async () => {
    const member = await signedIn();
    await connect("google", "person@example.com", "Australia/Sydney");
    // Local midnight on 1 December in Sydney.
    const { task } = await createTask(member, {
      dueDate: "2026-11-30T13:00:00.000Z",
    });
    const [event] = fake.events("google", "person@example.com");
    expect(event).toMatchObject({
      summary: "Ship the release notes",
      start: { date: "2026-12-01" },
      end: { date: "2026-12-02" },
    });

    // The app's own calendar view does not show the copy twice.
    const listed = await app.request(
      `${BASE}/events?from=2026-11-01T00:00:00Z&to=2027-01-01T00:00:00Z`,
    );
    expect((await listed.json()).events).toEqual([]);

    const moved = await app.request(`/api/task/due-date/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dueDate: "2026-12-04T13:00:00.000Z" }),
    });
    expect(moved.status).toBe(200);
    await settleEvents();
    const events = fake.events("google", "person@example.com");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      start: { date: "2026-12-05" },
      end: { date: "2026-12-06" },
    });

    const cleared = await app.request(`/api/task/due-date/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(cleared.status).toBe(200);
    await settleEvents();
    expect(fake.events("google", "person@example.com")).toEqual([]);
  });

  it("leaves the calendar alone when nothing it shows changed", async () => {
    const member = await signedIn();
    await connect("google", "person@example.com");
    const { task, projectId } = await createTask(member, {
      dueDate: "2026-12-01T00:00:00.000Z",
    });
    const before = fake.requests.length;
    await publishEvent("task.updated", { taskId: task.id, projectId });
    await settleEvents();
    const sync = await app.request(`${BASE}/sync`, { method: "POST" });
    expect(await sync.json()).toEqual({ synced: 1 });
    expect(fake.requests.slice(before)).toEqual([]);
  });

  it("removes the event when a move takes the task where the assignee cannot follow", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const assignee = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: owner.workspace.id,
      userId: assignee.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    await signedIn(assignee);
    await connect("google", "assignee@example.com");
    await signedIn(owner);
    const { task } = await createTask(owner, {
      userId: assignee.user.id,
      dueDate: "2026-12-01T00:00:00.000Z",
    });
    expect(fake.events("google", "assignee@example.com")).toHaveLength(1);

    const { project: hidden } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    await db
      .update(schema.projectTable)
      .set({ isPrivate: true })
      .where(eq(schema.projectTable.id, hidden.id));
    const moved = await app.request(`/api/task/move/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destinationProjectId: hidden.id }),
    });
    expect(moved.status).toBe(200);
    await settleEvents();
    expect(fake.events("google", "assignee@example.com")).toEqual([]);
  });

  it("writes all-day due dates to Outlook at midnight", async () => {
    const member = await signedIn();
    await connect("microsoft", "person@example.com");
    await createTask(member, { dueDate: "2026-12-01T00:00:00.000Z" });
    const [event] = fake.events("microsoft", "person@example.com");
    expect(event).toMatchObject({
      subject: "Ship the release notes",
      isAllDay: true,
      start: { dateTime: "2026-12-01T00:00:00", timeZone: "UTC" },
      end: { dateTime: "2026-12-02T00:00:00", timeZone: "UTC" },
    });
  });

  it("removes the event when the task is deleted", async () => {
    const member = await signedIn(
      await createWorkspaceMember({ role: "owner" }),
    );
    await connect("google", "person@example.com");
    const { task } = await createTask(member, {
      dueDate: "2026-12-01T00:00:00.000Z",
    });
    const response = await app.request(`/api/task/${task.id}`, {
      method: "DELETE",
    });
    expect(response.status).toBe(200);
    await settleEvents();
    expect(fake.events("google", "person@example.com")).toEqual([]);
    expect(await db.select().from(schema.calendarTaskEventTable)).toEqual([]);
  });

  it("only writes to the assignee's calendar", async () => {
    const owner = await signedIn();
    await connect("google", "owner@example.com");
    const other = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: owner.workspace.id,
      userId: other.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    await createTask(owner, {
      userId: other.user.id,
      dueDate: "2026-12-01T00:00:00.000Z",
    });
    expect(fake.events("google", "owner@example.com")).toEqual([]);
  });

  it("never writes a task from a team the assignee cannot open", async () => {
    const member = await signedIn();
    await connect("google", "person@example.com");
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const { task } = await createTask(
      member,
      { dueDate: "2026-12-01T00:00:00.000Z" },
      project.id,
    );
    expect(fake.events("google", "person@example.com")).toHaveLength(1);

    // The team turns private and the person holds no grant for it.
    await db
      .update(schema.projectTable)
      .set({ isPrivate: true })
      .where(eq(schema.projectTable.id, project.id));
    await publishEvent("task.bulk_unassigned", { projectId: project.id });
    await settleEvents();
    expect(fake.events("google", "person@example.com")).toEqual([]);

    const sync = await app.request(`${BASE}/sync`, { method: "POST" });
    expect(await sync.json()).toEqual({ synced: 0 });
    expect(fake.events("google", "person@example.com")).toEqual([]);
    expect(task.id).toBeTruthy();
  });

  it("removes the events of someone who left the workspace", async () => {
    const member = await signedIn();
    await connect("google", "person@example.com");
    await createTask(member, { dueDate: "2026-12-01T00:00:00.000Z" });
    expect(fake.events("google", "person@example.com")).toHaveLength(1);

    await db
      .delete(schema.workspaceUserTable)
      .where(eq(schema.workspaceUserTable.userId, member.user.id));
    await publishEvent("project_members.updated", {
      workspaceId: member.workspace.id,
    });
    await settleEvents();
    expect(fake.events("google", "person@example.com")).toEqual([]);
  });

  it("backfills tasks that already had due dates when asked to sync", async () => {
    unconfigure();
    const member = await signedIn();
    await createTask(member, { dueDate: "2026-12-01T00:00:00.000Z" });
    await createTask(member, { title: "No date" });
    configure();
    await connect("google", "person@example.com");
    await settleEvents();

    const response = await app.request(`${BASE}/sync`, { method: "POST" });
    expect(await response.json()).toEqual({ synced: 1 });
    expect(fake.events("google", "person@example.com")).toEqual([
      expect.objectContaining({ summary: "Ship the release notes" }),
    ]);
  });
});
