import { once } from "node:events";
import { readFileSync } from "node:fs";
import type { IncomingMessage } from "node:http";
import { createRequire } from "node:module";
import { defaultRolePayloads } from "@kaneo/permissions";
import { and, eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { serve } from "../../apps/api/node_modules/@hono/node-server";
import db, { schema } from "../../apps/api/src/database";
import {
  chatChannelMemberTable,
  chatChannelTable,
  chatMessageTable,
  referenceTable,
  savedViewTable,
  topicTable,
} from "../../apps/api/src/database/schema";
import { markInternalRequest } from "../../apps/api/src/agent/internal-auth";
import { settleEvents } from "../../apps/api/src/events";
import { createApp } from "../../apps/api/src/index";
import {
  initializeWebSocketAdapter,
  shutdownWebSocketAdapter,
} from "../../apps/api/src/ws";
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
  const [planDoc] = await db
    .insert(schema.documentTable)
    .values({
      workspaceId,
      title: "Canary launch plan",
      scope: "project",
      workProjectId: roadmap.id,
      creatorId: owner.userId,
    })
    .returning();
  const [loop] = await db
    .insert(schema.loopTable)
    .values({
      workspaceId,
      creatorId: owner.userId,
      name: "Canary weekly digest",
      instructions: "Summarise canary salaries",
    })
    .returning();
  const [topic] = await db
    .insert(topicTable)
    .values({ workspaceId, name: "Canary pricing", creatorId: owner.userId })
    .returning();
  const [view] = await db
    .insert(savedViewTable)
    .values({
      workspaceId,
      ownerId: owner.userId,
      visibility: "shared",
      name: "Canary board",
      filters: {},
      display: {},
    })
    .returning();
  await db.insert(schema.activityTable).values({
    taskId: qTask.id,
    type: "comment",
    userId: owner.userId,
    content: "Canary comment on salaries",
  });
  const [label] = await db
    .insert(schema.labelTable)
    .values({
      name: "Canary label",
      color: "#ff0000",
      taskId: qTask.id,
      workspaceId,
      projectId: q.project.id,
    })
    .returning();
  const [cycle] = await db
    .insert(schema.cycleTable)
    .values({
      projectId: q.project.id,
      number: 1,
      name: "Canary sprint",
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 7 * 86_400_000),
    })
    .returning();
  const [timeEntry] = await db
    .insert(schema.timeEntryTable)
    .values({
      taskId: qTask.id,
      userId: owner.userId,
      description: "Canary hours",
      startTime: new Date(),
    })
    .returning();
  const [asset] = await db
    .insert(schema.assetTable)
    .values({
      workspaceId,
      projectId: q.project.id,
      taskId: qTask.id,
      objectKey: "canary-object",
      filename: "canary.png",
      mimeType: "image/png",
      size: 3,
      surface: "description",
      createdBy: owner.userId,
    })
    .returning();
  const [chat] = await db
    .insert(schema.agentChatTable)
    .values({ workspaceId, userId: owner.userId, title: "Canary chat" })
    .returning();
  const [run] = await db
    .insert(schema.loopRunTable)
    .values({ loopId: loop.id, trigger: "manual", status: "succeeded" })
    .returning();

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

  // Links from Q into what the guest can open, made the way people make
  // them: a comment on the Q task that mentions the guest and the teammate,
  // and a relation from the P task to the Q task.
  const mention = await ownerRequest(`/comment/${qTask.id}`, {
    method: "POST",
    body: {
      content: `<kaneo-mention id="${guest.userId}">@Guest</kaneo-mention> <kaneo-mention id="${teammate.userId}">@Teammate</kaneo-mention> canary payroll numbers`,
    },
  });
  expect(mention.status, await mention.clone().text()).toBe(200);
  const related = await ownerRequest("/task-relation", {
    method: "POST",
    body: {
      sourceTaskId: pTask.id,
      targetTaskId: qTask.id,
      relationType: "related",
    },
  });
  expect(related.status, await related.clone().text()).toBe(200);
  await settleEvents();

  // Hidden sources that name what the guest can open: P and its task.
  await db.insert(referenceTable).values([
    {
      workspaceId,
      sourceTaskId: qTask.id,
      place: "description",
      targetTaskId: pTask.id,
    },
    {
      workspaceId,
      sourceDocumentId: workspaceDoc.id,
      place: "document",
      targetTaskId: pTask.id,
    },
    {
      workspaceId,
      sourceDocumentId: planDoc.id,
      place: "document",
      targetProjectId: p.project.id,
    },
    {
      workspaceId,
      sourceTaskId: qTask.id,
      place: "comment",
      targetProjectId: p.project.id,
    },
  ]);

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
    planDoc,
    roadmap,
    loop,
    topic,
    view,
    x,
    y,
    label,
    cycle,
    timeEntry,
    asset,
    chat,
    run,
  };
}

type World = Awaited<ReturnType<typeof setUp>>;

// An invitation id is its own credential and avatars are public by design.
const SKIPPED_PREFIXES = ["/invitation/", "/user/avatar/"];

type Side = "hidden" | "own";

/**
 * Every documented GET, filled in either with ids from outside the guest's
 * reach (they must be refused) or with the guest's own P and X (they must
 * answer without naming anything outside).
 */
function sweepPaths(world: World, side: Side = "hidden") {
  const openapi = JSON.parse(
    readFileSync(
      new URL("../../apps/docs/openapi.json", import.meta.url),
      "utf8",
    ),
  ) as { paths: Record<string, Record<string, unknown>> };
  const own = side === "own";
  const values: Record<string, string> = {
    workspaceId: world.workspaceId,
    projectId: own ? world.p.id : world.q.id,
    taskId: own ? world.pTask.id : world.qTask.id,
    documentId: world.workspaceDoc.id,
    channelId: own ? world.x.id : world.y.id,
    userId: own ? world.owner.userId : world.teammate.userId,
    workProjectId: world.roadmap.id,
    chatId: world.chat.id,
    runId: world.run.id,
    assetId: world.asset.id,
    provider: "github",
    ticketId: `${(own ? world.p : world.q).slug}-1`,
  };
  // What `{id}` names, by the route it appears in.
  const ids: [string, string[]][] = [
    ["/project/", [own ? world.p.id : world.q.id]],
    ["/public-project/", [own ? world.p.id : world.q.id]],
    ["/task/", [own ? world.pTask.id : world.qTask.id]],
    ["/work-project/", [world.roadmap.id]],
    ["/view/", [world.view.id]],
    ["/loop/", [world.loop.id]],
    ["/document/", [world.workspaceDoc.id, world.planDoc.id]],
    ["/topic/", [world.topic.id]],
    ["/label/", [world.label.id]],
    ["/cycle/", [world.cycle.id]],
    ["/time-entry/", [world.timeEntry.id]],
    ["/asset/", [world.asset.id]],
  ];
  const paths: string[] = [];
  for (const [path, operations] of Object.entries(openapi.paths)) {
    if (!operations.get) continue;
    if (SKIPPED_PREFIXES.some((prefix) => path.startsWith(prefix))) continue;
    const params = [...path.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
    const idValues = params.includes("id")
      ? (ids.find(([prefix]) => path.startsWith(prefix))?.[1] ?? [])
      : [""];
    for (const id of idValues) {
      const known = { ...values, ...(id ? { id } : {}) };
      if (params.some((param) => !known[param])) continue;
      paths.push(
        path.replace(/\{(\w+)\}/g, (_, param: string) => known[param] ?? ""),
      );
    }
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

    // Pickers still list the people of P, and only them, by name and
    // avatar: a guest sees no one's email address but their own.
    for (const path of [
      `/auth/organization/list-members?organizationId=${workspaceId}`,
      `/auth/organization/get-full-organization?organizationId=${workspaceId}`,
      `/workspace/${workspaceId}/members`,
    ]) {
      const people = await bodyOf(guestRequest, path);
      expect(people.status, path).toBe(200);
      expect(people.text, path).toContain('"Owner"');
      expect(people.text, path).not.toContain("owner@example.test");
      expect(people.text, path).toContain("guest@example.test");
      expect(people.text, path).not.toMatch(CANARY);
    }
    // Members keep seeing addresses.
    const forMember = await bodyOf(
      world.ownerRequest,
      `/workspace/${workspaceId}/members`,
    );
    expect(forMember.text).toContain("canary-teammate@example.test");
  });

  it("leaks nothing outside P and X through any read", async () => {
    const world = await setUp();
    const leaks: string[] = [];
    const sides = [...sweepPaths(world), ...sweepPaths(world, "own")];
    // Activity, comments and notifications are read with the guest's own
    // task, too, so a hidden author or source would show up in an answer.
    expect(sides).toEqual(
      expect.arrayContaining([
        `/activity/${world.pTask.id}`,
        `/comment/${world.pTask.id}`,
        `/reference/task/${world.pTask.id}`,
        `/reference/project/${world.p.id}`,
        "/notification",
        `/admin/users/${world.teammate.userId}/sessions`,
      ]),
    );
    const reads = [
      ...sides,
      ...sides.map((path) => `${path}?workspaceId=${world.workspaceId}`),
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

  it("keeps a guest out of people and role changes on every path", async () => {
    const world = await setUp();
    const { workspaceId, guest } = world;
    // Even a workspace that lets members invite does not let its guests.
    await db
      .update(schema.workspaceRoleTable)
      .set({
        permission: JSON.stringify({
          ...defaultRolePayloads.member,
          invitation: ["create"],
        }),
      })
      .where(
        and(
          eq(schema.workspaceRoleTable.workspaceId, workspaceId),
          eq(schema.workspaceRoleTable.role, "member"),
        ),
      );
    const invited = await world.guestRequest(
      "/auth/organization/invite-member",
      {
        method: "POST",
        body: {
          organizationId: workspaceId,
          email: "friend@example.test",
          role: "member",
          projectAccess: "selected",
          projectIds: [world.p.id],
        },
      },
    );
    expect(invited.status).toBe(403);
    expect(await invited.text()).toContain("GUEST_LIMIT");

    const operator = await signUpWithSession(app, {
      email: "operator@example.test",
      name: "Operator",
      role: "admin",
    });
    const operatorRequest = projectAccessApi({ cookie: operator.cookies });
    const promoted = await operatorRequest(
      `/admin/workspaces/${workspaceId}/members/${guest.userId}/role`,
      { method: "PUT", body: { role: "admin" } },
    );
    expect(promoted.status).toBe(409);
    const owned = await operatorRequest(
      `/admin/workspaces/${workspaceId}/owner`,
      {
        method: "PUT",
        body: { userId: guest.userId },
      },
    );
    expect(owned.status).toBe(409);
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

  it("shows a guest no invitations or teams, even when members may invite", async () => {
    const world = await setUp();
    const { workspaceId, ownerRequest, guestRequest } = world;
    await db
      .update(schema.workspaceRoleTable)
      .set({
        permission: JSON.stringify({
          ...defaultRolePayloads.member,
          invitation: ["create"],
        }),
      })
      .where(
        and(
          eq(schema.workspaceRoleTable.workspaceId, workspaceId),
          eq(schema.workspaceRoleTable.role, "member"),
        ),
      );
    const invited = await ownerRequest("/auth/organization/invite-member", {
      method: "POST",
      body: {
        organizationId: workspaceId,
        email: "canary-friend@example.test",
        role: "member",
        projectAccess: "selected",
        projectIds: [world.p.id],
      },
    });
    expect(invited.status).toBe(200);

    // The teammate holds the same role and does see it.
    const forTeammate = await bodyOf(
      world.teammateRequest,
      `/auth/organization/list-invitations?organizationId=${workspaceId}`,
    );
    expect(forTeammate.text).toContain("canary-friend@example.test");

    const listed = await guestRequest(
      `/auth/organization/list-invitations?organizationId=${workspaceId}`,
    );
    expect(listed.status).toBe(200);
    expect(await listed.json()).toEqual([]);
    const full = await guestRequest(
      `/auth/organization/get-full-organization?organizationId=${workspaceId}`,
    );
    expect(full.status).toBe(200);
    const organization = (await full.json()) as {
      invitations: unknown[];
      teams?: unknown[];
    };
    expect(organization.invitations).toEqual([]);
    expect(organization.teams).toEqual([]);
    // The workspace has teams; the owner sees them.
    const forOwner = (await (
      await ownerRequest(
        `/auth/organization/get-full-organization?organizationId=${workspaceId}`,
      )
    ).json()) as { teams: unknown[] };
    expect(forOwner.teams.length).toBeGreaterThan(0);
  });

  it("shows the links from Q to the people who can open Q, not to the guest", async () => {
    const world = await setUp();
    const relations = `/task-relation/${world.pTask.id}`;
    expect((await bodyOf(world.ownerRequest, relations)).text).toMatch(CANARY);
    expect((await bodyOf(world.teammateRequest, "/notification")).text).toMatch(
      CANARY,
    );

    for (const path of [
      relations,
      "/notification",
      `/activity/${world.pTask.id}`,
    ]) {
      const { status, text } = await bodyOf(world.guestRequest, path);
      expect(status, path).toBe(200);
      expect(text, path).not.toMatch(CANARY);
    }
  });

  it("shows a guest only references from inside their projects", async () => {
    const world = await setUp();
    const reads = [
      `/reference/task/${world.pTask.id}`,
      `/reference/project/${world.p.id}`,
    ];
    for (const path of reads) {
      // The owner sees every source, so the sources are really there.
      const forOwner = await bodyOf(world.ownerRequest, path);
      expect(forOwner.text, path).toMatch(CANARY);

      const forGuest = await world.guestRequest(path);
      expect(forGuest.status, path).toBe(200);
      expect(await forGuest.json(), path).toEqual({ references: [] });
    }
  });

  describe("over WebSocket", () => {
    let server: ReturnType<typeof serve> | null = null;
    let base = "";
    const sockets: { terminate(): void }[] = [];

    afterEach(async () => {
      for (const socket of sockets.splice(0)) socket.terminate();
      await shutdownWebSocketAdapter();
      const running = server;
      server = null;
      if (running) {
        await new Promise<void>((resolve, reject) =>
          running.close((error) => (error ? reject(error) : resolve())),
        );
      }
    });

    async function listen() {
      const created = createApp();
      server = serve({
        fetch: created.app.fetch,
        hostname: "127.0.0.1",
        port: 0,
      });
      created.injectWebSocket(server);
      if (!server.listening) await once(server, "listening");
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("No port");
      base = `127.0.0.1:${address.port}`;
      delete process.env.REDIS_URL;
      await initializeWebSocketAdapter();
    }

    const apiRequire = createRequire(
      new URL("../../apps/api/package.json", import.meta.url),
    );
    const WebSocket: new (
      url: string,
      options: { headers: Record<string, string> },
    ) => {
      once(event: string, listener: (...args: never[]) => void): void;
      on(event: string, listener: (...args: never[]) => void): void;
      terminate(): void;
    } = createRequire(apiRequire.resolve("@hono/node-ws"))("ws").WebSocket;

    /** 101 when the upgrade is accepted, else the refusal's status. */
    async function open(path: string, cookie: string) {
      return (await openCollecting(path, cookie)).status;
    }

    /** Opens a socket and keeps every message it receives. */
    async function openCollecting(path: string, cookie: string) {
      const socket = new WebSocket(`ws://${base}/api${path}`, {
        headers: { cookie, origin: "http://localhost:5173" },
      });
      sockets.push(socket);
      const received: unknown[] = [];
      socket.on("error", () => {});
      socket.on("message", (data: never) =>
        received.push(JSON.parse(String(data))),
      );
      const status = await new Promise<number>((resolve) => {
        socket.once("open", () => resolve(101));
        socket.once(
          "unexpected-response",
          (_request: never, response: IncomingMessage) => {
            response.resume();
            resolve(response.statusCode ?? 0);
          },
        );
      });
      return { status, received };
    }

    it("stops pushing a channel's messages to a guest taken out of it", async () => {
      await listen();
      const world = await setUp();
      const { workspaceId, x, guest, owner } = world;
      const guestSocket = await openCollecting(
        `/ws/chat/${x.id}`,
        guest.cookies,
      );
      const ownerSocket = await openCollecting(
        `/ws/chat/${x.id}`,
        owner.cookies,
      );
      expect([guestSocket.status, ownerSocket.status]).toEqual([101, 101]);

      const removed = await world.ownerRequest(
        `/chat/workspace/${workspaceId}/channels/${x.id}/members/${guest.userId}`,
        { method: "DELETE" },
      );
      expect(removed.status).toBe(200);
      const posted = await world.ownerRequest(
        `/chat/workspace/${workspaceId}/channels/${x.id}/messages`,
        { method: "POST", body: { body: "after the guest left" } },
      );
      expect(posted.status).toBe(200);
      await settleEvents();

      await vi.waitFor(() =>
        expect(JSON.stringify(ownerSocket.received)).toContain(
          "CHAT_MESSAGE_CREATED",
        ),
      );
      expect(JSON.stringify(guestSocket.received)).not.toContain(
        "CHAT_MESSAGE_CREATED",
      );
    });

    it("lets a guest subscribe only to their own channel and project", async () => {
      await listen();
      const world = await setUp();
      const cookie = world.guest.cookies;

      expect(await open(`/ws/chat/${world.x.id}`, cookie)).toBe(101);
      expect(await open(`/ws/${world.p.id}`, cookie)).toBe(101);
      expect(await open(`/ws/chat/${world.y.id}`, cookie)).toBe(404);
      expect(await open(`/ws/${world.q.id}`, cookie)).toBe(404);
    });
  });
});
