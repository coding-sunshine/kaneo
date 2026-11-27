import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import {
  chatChannelMemberTable,
  chatChannelTable,
  chatMessageTable,
  savedViewTable,
} from "../../apps/api/src/database/schema";
import { markInternalRequest } from "../../apps/api/src/agent/internal-auth";
import { createApp } from "../../apps/api/src/index";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
import { createProjectFixture } from "./helpers/fixtures";
import { createTaskFixture } from "./helpers/project-access/create-task-fixture";
import { projectAccessApi } from "./helpers/project-access/project-access-api";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";

type App = ReturnType<typeof createApp>["app"];
type Request = ReturnType<typeof projectAccessApi>;

// Everything outside project P and channel X carries this marker, so a guest
// response that contains it leaks something the guest must not see.
const CANARY = /canary/i;

let app: App;

async function setUp() {
  const owner = await signUpWithSession(app, {
    email: "owner@example.test",
    name: "Owner",
  });
  const ownerRequest = projectAccessApi({ cookie: owner.cookies });
  const created = await ownerRequest("/auth/organization/create", {
    method: "POST",
    body: { name: "Agency", slug: "agency" },
  });
  expect(created.status).toBe(200);
  const { id: workspaceId } = (await created.json()) as { id: string };

  const p = await createProjectFixture({ workspaceId, name: "Website" });
  const q = await createProjectFixture({ workspaceId, name: "Canary payroll" });
  const pTask = await createTaskFixture(p, "Fix the header", owner.userId);
  const qTask = await createTaskFixture(
    q,
    "Canary salary review",
    owner.userId,
  );

  // A teammate who only works on Q.
  const teammate = await signUpWithSession(app, {
    email: "canary-teammate@example.test",
    name: "Canary Teammate",
  });
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: teammate.userId,
    role: "member",
    joinedAt: new Date(),
  });
  await restrictToProjects(workspaceId, teammate.userId, [q.project.id]);

  const [workspaceDoc] = await db
    .insert(schema.documentTable)
    .values({
      workspaceId,
      title: "Canary company handbook",
      scope: "workspace",
      creatorId: owner.userId,
    })
    .returning();

  const [roadmap] = await db
    .insert(schema.workProjectTable)
    .values({ workspaceId, name: "Canary roadmap" })
    .returning();
  await db.insert(schema.documentTable).values({
    workspaceId,
    title: "Canary launch plan",
    scope: "project",
    workProjectId: roadmap.id,
    creatorId: owner.userId,
  });
  await db.insert(savedViewTable).values({
    workspaceId,
    ownerId: owner.userId,
    visibility: "shared",
    name: "Canary board",
    filters: {},
    display: {},
  });
  await db.insert(schema.activityTable).values({
    taskId: qTask.id,
    type: "comment",
    userId: owner.userId,
    content: "Canary comment on salaries",
  });

  const [x] = await db
    .insert(chatChannelTable)
    .values({ workspaceId, name: "client-website", createdBy: owner.userId })
    .returning();
  const [y] = await db
    .insert(chatChannelTable)
    .values({ workspaceId, name: "canary-general", createdBy: owner.userId })
    .returning();
  await db.insert(chatChannelMemberTable).values([
    { channelId: x.id, userId: owner.userId },
    { channelId: y.id, userId: owner.userId },
    { channelId: y.id, userId: teammate.userId },
  ]);
  await db.insert(chatMessageTable).values([
    { channelId: x.id, userId: owner.userId, body: "Welcome aboard" },
    { channelId: y.id, userId: owner.userId, body: "Canary internal news" },
  ]);

  const invited = await ownerRequest("/auth/organization/invite-member", {
    method: "POST",
    body: {
      organizationId: workspaceId,
      email: "guest@example.test",
      role: "member",
      projectAccess: "selected",
      projectIds: [p.project.id],
      guest: true,
      channelIds: [x.id],
    },
  });
  expect(invited.status, await invited.clone().text()).toBe(200);
  const invitation = (await invited.json()) as { id: string };
  const guest = await signUpWithSession(app, {
    email: "guest@example.test",
    name: "Guest",
  });
  const guestRequest = projectAccessApi({ cookie: guest.cookies });
  const accepted = await guestRequest("/auth/organization/accept-invitation", {
    method: "POST",
    body: { invitationId: invitation.id },
  });
  expect(accepted.status, await accepted.clone().text()).toBe(200);
  await guestRequest("/auth/organization/set-active", {
    method: "POST",
    body: { organizationId: workspaceId },
  });

  return {
    workspaceId,
    owner,
    ownerRequest,
    teammate,
    teammateRequest: projectAccessApi({ cookie: teammate.cookies }),
    guest,
    guestRequest,
    p: p.project,
    q: q.project,
    pTask,
    qTask,
    workspaceDoc,
    roadmap,
    x,
    y,
  };
}

type World = Awaited<ReturnType<typeof setUp>>;

const SKIPPED_PREFIXES = [
  "/admin/",
  "/auth/device",
  "/mcp/",
  "/oauth/",
  "/github-reviews",
  "/github-integration",
  "/import/trello",
];

function sweepPaths(world: World) {
  const openapi = JSON.parse(
    readFileSync(
      new URL("../../apps/docs/openapi.json", import.meta.url),
      "utf8",
    ),
  ) as { paths: Record<string, Record<string, unknown>> };
  const values: Record<string, string> = {
    workspaceId: world.workspaceId,
    projectId: world.q.id,
    taskId: world.qTask.id,
    documentId: world.workspaceDoc.id,
    channelId: world.y.id,
    userId: world.teammate.userId,
    workProjectId: world.roadmap.id,
  };
  const paths: string[] = [];
  for (const [path, operations] of Object.entries(openapi.paths)) {
    if (!operations.get) continue;
    if (SKIPPED_PREFIXES.some((prefix) => path.startsWith(prefix))) continue;
    const params = [...path.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
    if (params.some((param) => !values[param])) continue;
    paths.push(
      path.replace(/\{(\w+)\}/g, (_, param: string) => values[param] ?? ""),
    );
  }
  return paths;
}

async function bodyOf(request: Request, path: string) {
  const response = await request(path);
  return { status: response.status, text: await response.text() };
}

beforeEach(async () => {
  await resetTestDatabase();
  ({ app } = createApp());
});

describe("guest access", () => {
  it("shows a guest only project P and channel X", async () => {
    const world = await setUp();
    const { guestRequest, workspaceId } = world;

    const projects = await bodyOf(
      guestRequest,
      `/project?workspaceId=${workspaceId}`,
    );
    expect(projects.status).toBe(200);
    expect(projects.text).toContain("Website");
    expect(projects.text).not.toMatch(CANARY);

    const channels = await guestRequest(
      `/chat/workspace/${workspaceId}/channels`,
    );
    expect(channels.status).toBe(200);
    const listed = (await channels.json()) as { id: string }[];
    expect(listed.map((channel) => channel.id)).toEqual([world.x.id]);

    const messages = await bodyOf(
      guestRequest,
      `/chat/workspace/${workspaceId}/channels/${world.x.id}/messages`,
    );
    expect(messages.status).toBe(200);
    expect(messages.text).toContain("Welcome aboard");
  });

  it("leaks nothing outside P and X through any read", async () => {
    const world = await setUp();
    const leaks: string[] = [];
    const reads = [
      ...sweepPaths(world),
      ...sweepPaths(world).map(
        (path) => `${path}?workspaceId=${world.workspaceId}`,
      ),
      `/search?q=canary&workspaceId=${world.workspaceId}`,
      "/search?q=canary",
      `/workspace/${world.workspaceId}/members?projectId=${world.p.id}`,
      `/auth/organization/get-full-organization?organizationId=${world.workspaceId}`,
      `/auth/organization/list-members?organizationId=${world.workspaceId}`,
      "/auth/organization/list-teams",
    ];
    for (const path of reads) {
      const { status, text } = await bodyOf(world.guestRequest, path);
      // Search echoes the query back; that is not a leak.
      const body = text.replace('"searchQuery":"canary"', "");
      if (CANARY.test(body)) leaks.push(`${status} ${path}`);
    }
    expect(leaks).toEqual([]);
  });

  it("refuses channel moves a guest has no need for", async () => {
    const world = await setUp();
    const { guestRequest, workspaceId, y } = world;
    const base = `/chat/workspace/${workspaceId}/channels`;

    expect((await guestRequest(`${base}/${y.id}`)).status).toBe(404);
    expect(
      (await guestRequest(`${base}/${y.id}/join`, { method: "POST" })).status,
    ).toBe(404);
    expect(
      (
        await guestRequest(base, {
          method: "POST",
          body: { name: "side-door" },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await guestRequest(`${base}/${world.x.id}/members`, {
          method: "POST",
          body: { userId: world.teammate.userId },
        })
      ).status,
    ).toBe(403);
  });

  it("ends channel access as soon as the guest is removed", async () => {
    const world = await setUp();
    const { ownerRequest, guestRequest, workspaceId, x, guest } = world;
    const messages = `/chat/workspace/${workspaceId}/channels/${x.id}/messages`;
    expect((await guestRequest(messages)).status).toBe(200);

    const removed = await ownerRequest(
      `/chat/workspace/${workspaceId}/channels/${x.id}/members/${guest.userId}`,
      { method: "DELETE" },
    );
    expect(removed.status).toBe(200);

    expect((await guestRequest(messages)).status).toBe(404);
    const channels = (await (
      await guestRequest(`/chat/workspace/${workspaceId}/channels`)
    ).json()) as unknown[];
    expect(channels).toEqual([]);
  });

  it("does not let a member add a guest to another channel", async () => {
    const world = await setUp();
    const { teammateRequest, workspaceId, y, guest } = world;
    const added = await teammateRequest(
      `/chat/workspace/${workspaceId}/channels/${y.id}/members`,
      { method: "POST", body: { userId: guest.userId } },
    );
    expect(added.status).toBe(403);
    const [member] = await db
      .select()
      .from(chatChannelMemberTable)
      .where(eq(chatChannelMemberTable.userId, guest.userId));
    expect(member?.channelId).toBe(world.x.id);
  });

  it("keeps a guest from widening their own reach", async () => {
    const world = await setUp();
    const { guestRequest, ownerRequest, workspaceId, guest } = world;

    expect(
      (
        await guestRequest("/project", {
          method: "POST",
          body: { workspaceId, name: "Side project", slug: "side" },
        })
      ).status,
    ).toBe(403);

    const widened = await ownerRequest(
      `/workspace/${workspaceId}/members/${guest.userId}/project-access`,
      { method: "PUT", body: { projectAccess: "all", projectIds: [] } },
    );
    expect(widened.status).toBe(409);

    const [membership] = await db
      .select({ id: schema.workspaceUserTable.id })
      .from(schema.workspaceUserTable)
      .where(eq(schema.workspaceUserTable.userId, guest.userId));
    const promoted = await ownerRequest(
      "/auth/organization/update-member-role",
      {
        method: "POST",
        body: {
          organizationId: workspaceId,
          memberId: membership.id,
          role: "admin",
        },
      },
    );
    expect(promoted.status).toBeGreaterThanOrEqual(400);
  });

  it("holds the guest's AI to the guest's reach", async () => {
    const world = await setUp();
    // The assistant and background runs call the API as the guest: forwarded
    // credentials, an API key, or an in-process run marked with the guest id.
    const keyResponse = await world.guestRequest("/auth/api-key/create", {
      method: "POST",
      body: { name: "Assistant" },
    });
    expect(keyResponse.status).toBe(200);
    const key = (await keyResponse.json()) as { id: string; key: string };
    await db
      .update(schema.apikeyTable)
      .set({ rateLimitEnabled: false })
      .where(eq(schema.apikeyTable.id, key.id));
    const viaKey = projectAccessApi({ "x-api-key": key.key });
    const viaRun: Request = async (path) => {
      const request = new Request(`http://localhost/api${path}`);
      markInternalRequest(request, world.guest.userId);
      return app.fetch(request);
    };

    for (const request of [viaKey, viaRun]) {
      const own = await bodyOf(request, `/task/${world.pTask.id}`);
      expect(own.status).toBe(200);
      const other = await bodyOf(request, `/task/${world.qTask.id}`);
      expect([403, 404]).toContain(other.status);
      for (const path of [
        `/search?q=canary&workspaceId=${world.workspaceId}`,
        `/document/workspace/${world.workspaceId}`,
        `/workspace/${world.workspaceId}/members`,
        `/chat/workspace/${world.workspaceId}/channels`,
        `/chat/workspace/${world.workspaceId}/channels/${world.y.id}/messages`,
      ]) {
        const { text } = await bodyOf(request, path);
        expect(text.replace('"searchQuery":"canary"', ""), path).not.toMatch(
          CANARY,
        );
      }
    }
  });
});
