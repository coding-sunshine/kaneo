import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import {
  chatChannelTable,
  invitationTable,
  onboardingChecklistTable,
} from "../../apps/api/src/database/schema";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

type App = ReturnType<typeof createApp>["app"];
type Api = ReturnType<typeof client>;

type Checklist = {
  workspaceId: string | null;
  handbookDocumentId: string | null;
  welcomeChannelId: string | null;
  sampleTask: { id: string; projectId: string } | null;
  items: { id: string; done: boolean }[];
} | null;

function client(app: App, cookies: string) {
  return (path: string, init: { method?: string; body?: unknown } = {}) =>
    app.request(`/api${path}`, {
      method: init.method ?? "GET",
      headers: { cookie: cookies, "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
}

async function signUp(app: App, email: string) {
  const { userId, cookies } = await signUpWithSession(app, {
    email,
    name: "New Hire",
  });
  return { userId, api: client(app, cookies) };
}

async function seed(api: Api) {
  const response = await api("/onboarding/welcome-workspace", {
    method: "POST",
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as { workspaceId: string | null })
    .workspaceId;
}

async function signUpAndSeed(app: App, email: string) {
  const user = await signUp(app, email);
  const workspaceId = await seed(user.api);
  expect(workspaceId).toBeTruthy();
  return { ...user, workspaceId };
}

async function readChecklist(api: Api) {
  const response = await api("/onboarding/checklist");
  expect(response.status).toBe(200);
  return (await response.json()) as Checklist;
}

const done = (checklist: Checklist, id: string) =>
  checklist?.items.find((item) => item.id === id)?.done;

const tick = (api: Api, item: string) =>
  api(`/onboarding/checklist/items/${item}/complete`, { method: "POST" });

async function workspacesOf(userId: string) {
  return db
    .select({ id: schema.workspaceUserTable.workspaceId })
    .from(schema.workspaceUserTable)
    .where(eq(schema.workspaceUserTable.userId, userId));
}

describe("API integration: onboarding checklist", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    vi.unstubAllEnvs();
  });

  it("makes a welcome workspace and a five-item checklist for a new user", async () => {
    const { app } = createApp();
    const { userId, api } = await signUp(app, "hire@example.com");
    // Sign-up alone leaves the user with no workspace and no visible checklist.
    expect(await workspacesOf(userId)).toEqual([]);
    expect(await readChecklist(api)).toBeNull();

    const workspaceId = await seed(api);
    const checklist = await readChecklist(api);
    expect(checklist?.workspaceId).toBe(workspaceId);
    expect(checklist?.items.map((item) => item.id)).toEqual([
      "set-status",
      "read-handbook",
      "say-hello",
      "open-sample-ticket",
      "invite-teammate",
    ]);
    expect(checklist?.items.every((item) => !item.done)).toBe(true);
    expect(await workspacesOf(userId)).toEqual([{ id: workspaceId }]);

    const [handbook] = await db
      .select()
      .from(schema.documentTable)
      .where(eq(schema.documentTable.workspaceId, workspaceId ?? ""));
    expect(handbook?.id).toBe(checklist?.handbookDocumentId);
    expect(handbook?.title).toBe("Handbook");
    expect(handbook?.scope).toBe("workspace");

    const channels = await db
      .select()
      .from(chatChannelTable)
      .where(eq(chatChannelTable.workspaceId, workspaceId ?? ""));
    expect(channels.map((channel) => channel.name)).toEqual(["welcome"]);
    expect(channels[0]?.id).toBe(checklist?.welcomeChannelId);
    expect(channels[0]?.isPrivate).toBe(false);

    const tasks = await db
      .select({ id: schema.taskTable.id })
      .from(schema.taskTable)
      .innerJoin(
        schema.projectTable,
        eq(schema.projectTable.id, schema.taskTable.projectId),
      )
      .where(eq(schema.projectTable.workspaceId, workspaceId ?? ""));
    expect(tasks).toEqual([{ id: checklist?.sampleTask?.id }]);

    // The page shows up in the owner's document list.
    const listed = await api(`/document/workspace/${workspaceId}`);
    expect(listed.status).toBe(200);
    expect(JSON.stringify(await listed.json())).toContain(handbook?.id);
  });

  it("makes the welcome workspace only once", async () => {
    const { app } = createApp();
    const { userId, api } = await signUp(app, "hire@example.com");
    const results = await Promise.all([seed(api), seed(api)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await seed(api)).toBeNull();
    expect(await workspacesOf(userId)).toHaveLength(1);
  });

  it("makes nothing for someone who already has a workspace", async () => {
    const { app } = createApp();
    const { userId, api } = await signUp(app, "hire@example.com");
    const { workspace } = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: workspace.id,
      userId,
      role: "member",
      joinedAt: new Date(),
    });

    expect(await seed(api)).toBeNull();
    expect(await workspacesOf(userId)).toEqual([{ id: workspace.id }]);
    expect(await readChecklist(api)).toBeNull();
  });

  it("makes nothing for someone with an invitation waiting", async () => {
    const { app } = createApp();
    const { user: inviter, workspace } = await createWorkspaceMember({
      role: "owner",
    });
    await db.insert(invitationTable).values({
      id: "invitation-for-hire",
      workspaceId: workspace.id,
      email: "invited@example.com",
      role: "member",
      status: "pending",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      inviterId: inviter.id,
    });
    const { userId, api } = await signUp(app, "invited@example.com");

    expect(await seed(api)).toBeNull();
    expect(await workspacesOf(userId)).toEqual([]);
    expect(await readChecklist(api)).toBeNull();
  });

  it("makes nothing when workspace creation is restricted for the user", async () => {
    const { app } = createApp();
    // The first account becomes the instance administrator.
    await signUp(app, "admin@example.com");
    vi.stubEnv("DISABLE_WORKSPACE_CREATION", "true");
    const { userId, api } = await signUp(app, "hire@example.com");

    expect(await seed(api)).toBeNull();
    expect(await workspacesOf(userId)).toEqual([]);
    expect(await readChecklist(api)).toBeNull();
    vi.unstubAllEnvs();
    // Once creation opens up, the welcome workspace can still be made.
    expect(await seed(api)).toBeTruthy();
  });

  it("ticks 'Set your status' when the status is set, and only then", async () => {
    const { app } = createApp();
    const { api } = await signUpAndSeed(app, "hire@example.com");

    // The status item is earned, never ticked by hand.
    expect((await tick(api, "set-status")).status).toBe(400);
    expect(done(await readChecklist(api), "set-status")).toBe(false);

    await api("/user/profile", {
      method: "PATCH",
      body: { jobTitle: "Engineer" },
    });
    expect(done(await readChecklist(api), "set-status")).toBe(false);

    const updated = await api("/user/profile", {
      method: "PATCH",
      body: { status: { text: "Settling in" } },
    });
    expect(updated.status).toBe(200);
    expect(done(await readChecklist(api), "set-status")).toBe(true);

    // Clearing the status later keeps the tick.
    await api("/user/profile", { method: "PATCH", body: { status: null } });
    expect(done(await readChecklist(api), "set-status")).toBe(true);
  });

  it("ticks the other items by hand and can be dismissed", async () => {
    const { app } = createApp();
    const { api } = await signUpAndSeed(app, "hire@example.com");

    const ticked = await tick(api, "read-handbook");
    expect(ticked.status).toBe(200);
    expect(done((await ticked.json()) as Checklist, "read-handbook")).toBe(
      true,
    );
    // Ticking twice is harmless.
    await tick(api, "read-handbook");
    const checklist = await readChecklist(api);
    expect(checklist?.items.filter((item) => item.done)).toEqual([
      { id: "read-handbook", done: true },
    ]);

    expect((await tick(api, "no-such-item")).status).toBe(400);

    const dismissed = await api("/onboarding/checklist/dismiss", {
      method: "POST",
    });
    expect(dismissed.status).toBe(200);
    expect(await readChecklist(api)).toBeNull();
    // A dismissed checklist stays dismissed.
    expect((await tick(api, "say-hello")).status).toBe(404);
  });

  it("shows no checklist to users who existed before it", async () => {
    const { app } = createApp();
    const { user } = await createWorkspaceMember();
    const session = mockAuthenticatedSession(user);
    const api = client(app, "");

    expect(await seed(api)).toBeNull();
    expect(await readChecklist(api)).toBeNull();
    expect((await tick(api, "read-handbook")).status).toBe(404);
    expect(
      (await api("/onboarding/checklist/dismiss", { method: "POST" })).status,
    ).toBe(404);
    session.mockRestore();
  });

  it("keeps each person's checklist and welcome workspace to themselves", async () => {
    const { app } = createApp();
    const first = await signUpAndSeed(app, "first@example.com");
    const second = await signUpAndSeed(app, "second@example.com");
    const firstChecklist = await readChecklist(first.api);
    expect(second.workspaceId).not.toBe(first.workspaceId);

    // Ticking an item changes only the caller's own checklist.
    await tick(second.api, "say-hello");
    expect(done(await readChecklist(first.api), "say-hello")).toBe(false);

    // Someone else's welcome workspace stays closed to them.
    for (const path of [
      `/document/workspace/${first.workspaceId}`,
      `/chat/workspace/${first.workspaceId}/channels/${firstChecklist?.welcomeChannelId}/messages`,
    ])
      expect([403, 404]).toContain((await second.api(path)).status);
  });

  it("drops links to a welcome workspace the user has left", async () => {
    const { app } = createApp();
    const { userId, api } = await signUpAndSeed(app, "hire@example.com");
    const checklist = await readChecklist(api);
    await db
      .delete(schema.workspaceUserTable)
      .where(eq(schema.workspaceUserTable.userId, userId));

    const after = await readChecklist(api);
    expect(after?.items).toEqual(checklist?.items);
    expect(after?.workspaceId).toBeNull();
    expect(after?.handbookDocumentId).toBeNull();
    expect(after?.welcomeChannelId).toBeNull();
    expect(after?.sampleTask).toBeNull();
  });

  it("rejects requests without a user session", async () => {
    const { app } = createApp();
    for (const [method, path] of [
      ["POST", "/api/onboarding/welcome-workspace"],
      ["GET", "/api/onboarding/checklist"],
      ["POST", "/api/onboarding/checklist/items/read-handbook/complete"],
      ["POST", "/api/onboarding/checklist/dismiss"],
    ])
      expect((await app.request(path, { method })).status).toBe(401);
  });

  it("refuses API keys, even the new user's own", async () => {
    const { app } = createApp();
    const { userId, api } = await signUp(app, "hire@example.com");
    const created = await api("/auth/api-key/create", {
      method: "POST",
      body: { name: "test" },
    });
    expect(created.status).toBe(200);
    const { key } = (await created.json()) as { key: string };

    for (const [method, path] of [
      ["POST", "/api/onboarding/welcome-workspace"],
      ["GET", "/api/onboarding/checklist"],
      ["POST", "/api/onboarding/checklist/items/read-handbook/complete"],
      ["POST", "/api/onboarding/checklist/dismiss"],
    ])
      expect(
        (await app.request(path, { method, headers: { "x-api-key": key } }))
          .status,
      ).toBe(403);
    expect(await workspacesOf(userId)).toEqual([]);
  });

  it("gives anonymous guests no checklist and no workspace", async () => {
    const { app } = createApp();
    // Guest access opens once the instance has a registered account.
    await signUp(app, "admin@example.com");
    const response = await app.request("/api/auth/sign-in/anonymous", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:5173",
      },
      body: "{}",
    });
    expect(response.status).toBe(200);
    const { user } = (await response.json()) as { user: { id: string } };
    expect(
      await db
        .select()
        .from(onboardingChecklistTable)
        .where(eq(onboardingChecklistTable.userId, user.id)),
    ).toEqual([]);
    const cookies = response.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0])
      .join("; ");
    expect(await seed(client(app, cookies))).toBeNull();
    expect(await workspacesOf(user.id)).toEqual([]);
  });
});
