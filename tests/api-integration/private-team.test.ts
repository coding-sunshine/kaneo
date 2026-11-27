import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import {
  projectTriageResponsibleTable,
  topicSubscriberTable,
} from "../../apps/api/src/database/schema";
import { publishEvent, settleEvents } from "../../apps/api/src/events";
import { createApp } from "../../apps/api/src/index";
import { findLinkedIssues } from "../../apps/api/src/github-reviews/linked-issues";
import { checkDueDateReminders } from "../../apps/api/src/scheduler/due-date-reminders";
import { DUE_DATE_DURATION_MS } from "../../apps/api/src/scheduler/reminder-timing";
import { checkSlaNotifications } from "../../apps/api/src/scheduler/sla-notifications";
import { model, reply } from "./helpers/agent-model";
import { createInstanceAdmin } from "./helpers/admin/create-instance-admin";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";
import { createWorkspaceMember } from "./helpers/fixtures";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";
import { createInvitationWorkspace } from "./helpers/project-access/create-invitation-workspace";
import { projectAccessApi } from "./helpers/project-access/project-access-api";
import { putMemberProjectAccess } from "./helpers/project-access/put-member-project-access";
import { readMemberAccessRows } from "./helpers/project-access/read-member-access-rows";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";

// Loops talk to a scripted model; the file download reads a stubbed bucket.
vi.mock("../../apps/api/src/agent/openrouter", async (original) => ({
  ...(await original<object>()),
  createCompletion: async (messages: never) => {
    model.seen.push(messages);
    const next = model.queue.shift();
    if (!next) throw new Error("no scripted reply");
    return next;
  },
}));
vi.mock("../../apps/api/src/storage/s3", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getPrivateObject: async () => ({
    body: new Uint8Array([1, 2, 3]),
    contentType: "application/pdf",
    contentLength: 3,
  }),
}));

type World = DocumentWorld;
type User = World["owner"];
type Team = World["alpha"];

let world: World;
let counter = 100;

beforeEach(async () => {
  await resetTestDatabase();
  world = await buildDocumentWorld();
});

const getTeam = async (user: User, team: Team) => {
  const response = await world.as(user)(`/project/${team.id}`);
  expect(response.status).toBe(200);
  return (await response.json()) as { isPrivate: boolean };
};

// PUT /project/{id} needs every field each time; `extra` carries the new ones.
const putTeam = (user: User, team: Team, extra: Record<string, unknown> = {}) =>
  world.as(user)(
    `/project/${team.id}`,
    json("PUT", {
      name: team.name,
      icon: team.icon,
      slug: team.slug,
      description: team.description ?? "",
      isPublic: false,
      ...extra,
    }),
  );
const setPrivate = async (user: User, team: Team, value = true) => {
  const response = await putTeam(user, team, {
    isPrivate: value,
    confirmPrivate: value,
  });
  expect(response.status).toBe(200);
  expect(((await response.json()) as { isPrivate: boolean }).isPrivate).toBe(
    value,
  );
};

const addIssue = async (team: Team, assignee: User, title = "Mine") => {
  const [row] = await db
    .insert(schema.taskTable)
    .values({
      projectId: team.id,
      title,
      number: ++counter,
      userId: assignee.id,
    })
    .returning();
  return row;
};
const assigneeOf = async (taskId: string) =>
  (
    await db
      .select({ userId: schema.taskTable.userId })
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, taskId))
  )[0]?.userId;
const unassignedBy = async (taskId: string) =>
  (
    await db
      .select({ userId: schema.activityTable.userId })
      .from(schema.activityTable)
      .where(
        and(
          eq(schema.activityTable.taskId, taskId),
          eq(schema.activityTable.type, "unassigned"),
        ),
      )
  ).map((row) => row.userId);

const grantsOf = async (user: User) =>
  (await readMemberAccessRows(world.ws, user.id)).grants
    .map((grant) => grant.projectId)
    .sort();

const issueFile = async () => {
  const [row] = await db
    .insert(schema.assetTable)
    .values({
      workspaceId: world.ws,
      projectId: world.alpha.id,
      taskId: world.alphaTask.id,
      objectKey: `issue/${randomUUID()}`,
      filename: "notes.pdf",
      mimeType: "application/pdf",
      size: 3,
      kind: "attachment",
      surface: "attachment",
      createdBy: world.owner.id,
    })
    .returning();
  return row.id;
};

// Everything that tells a person whether they can open team Alpha.
async function alphaSurfaces(user: User, fileId: string) {
  const ask = (path: string) => world.as(user)(path);
  const teams = (await (
    await ask(`/project?workspaceId=${world.ws}`)
  ).json()) as { id: string }[];
  const search = await ask(
    `/search?workspaceId=${world.ws}&q=Alpha&type=tasks&limit=50`,
  );
  const searchText = await search.text();
  const files = (await (
    await ask(`/document/workspace/${world.ws}/issue-files`)
  ).json()) as { id: string }[];
  return {
    teamList: teams.some((team) => team.id === world.alpha.id),
    team: (await ask(`/project/${world.alpha.id}`)).status,
    issueList: (await ask(`/task/tasks/${world.alpha.id}`)).status,
    issue: (await ask(`/task/${world.alphaTask.id}`)).status,
    search: searchText.includes("Alpha issue"),
    document: (
      await ask(`/document/workspace/${world.ws}/${world.docs.teamAlpha}`)
    ).status,
    files: files.some((file) => file.id === fileId),
  };
}
const CAN_OPEN = {
  teamList: true,
  team: 200,
  issueList: 200,
  issue: 200,
  search: true,
  document: 200,
  files: true,
};
const CANNOT_OPEN = {
  teamList: false,
  team: 404,
  issueList: 404,
  issue: 403,
  search: false,
  document: 404,
  files: false,
};

describe("private teams: limits that exist today", () => {
  it("keeps member limits when no team is private", async () => {
    const ids = async (user: User) =>
      (
        (await (
          await world.as(user)(`/project?workspaceId=${world.ws}`)
        ).json()) as { id: string }[]
      )
        .map((team) => team.id)
        .sort();
    expect(await ids(world.limited)).toEqual([world.alpha.id]);
    expect(await ids(world.open)).toEqual(
      [world.alpha.id, world.beta.id].sort(),
    );
  });
});

describe("private teams: who can open one", () => {
  it("closes the team to members with no grant on every surface", async () => {
    const fileId = await issueFile();
    const admin = await createInstanceAdmin();
    for (const user of [world.open, world.limited, world.owner]) {
      expect(await alphaSurfaces(user, fileId)).toEqual(CAN_OPEN);
    }
    // An instance admin is no member, so only the routes that name the team.
    const adminOpens = async () => [
      (await world.as(admin)(`/project/${world.alpha.id}`)).status,
      (await world.as(admin)(`/task/${world.alphaTask.id}`)).status,
    ];
    expect(await adminOpens()).toEqual([200, 200]);
    const audience = async () =>
      (
        (await (
          await world.as(world.owner)(
            `/document/workspace/${world.ws}/${world.docs.teamAlpha}/audience`,
          )
        ).json()) as { current: { userId: string }[] }
      ).current.map((person) => person.userId);
    expect(await audience()).toContain(world.open.id);

    await setPrivate(world.owner, world.alpha);

    expect(await alphaSurfaces(world.open, fileId)).toEqual(CANNOT_OPEN);
    for (const user of [world.limited, world.owner]) {
      expect(await alphaSurfaces(user, fileId)).toEqual(CAN_OPEN);
    }
    expect(await adminOpens()).toEqual([200, 200]);
    const names = await audience();
    expect(names).not.toContain(world.open.id);
    expect(names).toContain(world.limited.id);
    expect(names).toContain(world.owner.id);
  });

  it("keeps a member added later out", async () => {
    const fileId = await issueFile();
    await setPrivate(world.owner, world.alpha);
    const late = await addWorkspaceMember(world.ws);
    expect(await alphaSurfaces(late, fileId)).toEqual(CANNOT_OPEN);
    expect(await alphaSurfaces(world.limited, fileId)).toEqual(CAN_OPEN);
  });
});

describe("private teams: turning privacy on and off", () => {
  it("refuses a plain member and lets an admin through", async () => {
    expect(
      (await putTeam(world.open, world.alpha, { isPrivate: true })).status,
    ).toBe(403);
    expect((await getTeam(world.owner, world.alpha)).isPrivate).toBe(false);
    const admin = await addWorkspaceMember(world.ws, "admin");
    await setPrivate(admin, world.alpha);
  });

  it("stops an admin outside the team from opening it again", async () => {
    const admin = await addWorkspaceMember(world.ws, "admin");
    await setPrivate(world.owner, world.alpha);
    expect(
      (await putTeam(admin, world.alpha, { isPrivate: false })).status,
    ).toBe(404);
    expect((await getTeam(world.owner, world.alpha)).isPrivate).toBe(true);
    await setPrivate(world.owner, world.alpha, false);
  });

  it("leaves the flag alone when the request does not mention it", async () => {
    await setPrivate(world.owner, world.alpha);
    const response = await putTeam(world.owner, world.alpha, {
      name: "Alpha renamed",
    });
    expect(response.status).toBe(200);
    expect(((await response.json()) as { isPrivate: boolean }).isPrivate).toBe(
      true,
    );
    expect((await getTeam(world.owner, world.alpha)).isPrivate).toBe(true);
  });

  it("refuses private together with public sharing, both ways", async () => {
    const both = await putTeam(world.owner, world.alpha, {
      isPrivate: true,
      isPublic: true,
    });
    expect(both.status).toBe(400);
    expect((await getTeam(world.owner, world.alpha)).isPrivate).toBe(false);

    await setPrivate(world.owner, world.alpha);
    const shared = await putTeam(world.owner, world.alpha, { isPublic: true });
    expect(shared.status).toBe(400);
    // The same call on a team that is not private goes through.
    expect(
      (await putTeam(world.owner, world.beta, { isPublic: true })).status,
    ).toBe(200);
  });

  it("gives a flipping admin a grant and the owner none", async () => {
    const admin = await addWorkspaceMember(world.ws, "admin");
    await setPrivate(admin, world.alpha);
    expect(await grantsOf(admin)).toEqual([world.alpha.id]);
    expect(await grantsOf(world.owner)).toEqual([]);
    await setPrivate(world.owner, world.beta);
    expect(await grantsOf(world.owner)).toEqual([]);
  });

  // A row left on an open team would keep its holder in if the team went
  // private later.
  it("writes no row for an unlimited member who makes a team beside a private one", async () => {
    await setPrivate(world.owner, world.alpha);
    const created = await world.as(world.open)(
      "/project",
      json("POST", {
        name: "Gamma",
        workspaceId: world.ws,
        icon: "Layout",
        slug: "gamma",
      }),
    );
    expect(created.status).toBe(200);
    expect(await grantsOf(world.open)).toEqual([]);
  });

  it("unassigns issues of people who lose the team and keeps the rest", async () => {
    const admin = await addWorkspaceMember(world.ws, "admin");
    const lost = await addIssue(world.alpha, world.open);
    const flippers = await addIssue(world.alpha, admin);
    const granted = await addIssue(world.alpha, world.limited);

    await setPrivate(admin, world.alpha);

    expect(await assigneeOf(lost.id)).toBeNull();
    expect(await unassignedBy(lost.id)).toEqual([admin.id]);
    expect(await assigneeOf(flippers.id)).toBe(admin.id);
    expect(await assigneeOf(granted.id)).toBe(world.limited.id);
    expect(await assigneeOf(world.alphaTask.id)).toBe(world.owner.id);
  });

  it("deletes the rows of unlimited members on reopening and keeps limited ones", async () => {
    const admin = await addWorkspaceMember(world.ws, "admin");
    await setPrivate(admin, world.alpha);
    const added = await world.as(admin)(
      `/project/${world.alpha.id}/private-members/${world.open.id}`,
      json("PUT"),
    );
    expect(added.status).toBe(200);
    expect(await grantsOf(admin)).toEqual([world.alpha.id]);
    expect(await grantsOf(world.open)).toEqual([world.alpha.id]);

    await setPrivate(admin, world.alpha, false);

    expect(await grantsOf(admin)).toEqual([]);
    expect(await grantsOf(world.open)).toEqual([]);
    expect(await grantsOf(world.limited)).toEqual([world.alpha.id]);
    expect((await getTeam(world.open, world.alpha)).isPrivate).toBe(false);
  });
});

describe("private teams: losses need a confirm", () => {
  const feedCount = async (team: Team) =>
    (
      await db
        .select({ id: schema.calendarFeedTable.id })
        .from(schema.calendarFeedTable)
        .where(eq(schema.calendarFeedTable.projectId, team.id))
    ).length;

  it("refuses a change that unassigns or deletes links until it is confirmed", async () => {
    const issue = await addIssue(world.alpha, world.open);
    const feed = await world.as(world.owner)(
      `/calendar-feed/project/${world.alpha.id}`,
      json("POST", { timeZone: "UTC" }),
    );
    expect(feed.status).toBe(201);

    const refused = await putTeam(world.owner, world.alpha, {
      isPrivate: true,
    });
    expect(refused.status).toBe(409);
    expect((await getTeam(world.owner, world.alpha)).isPrivate).toBe(false);
    expect(await assigneeOf(issue.id)).toBe(world.open.id);
    expect(await feedCount(world.alpha)).toBe(1);

    const confirmed = await putTeam(world.owner, world.alpha, {
      isPrivate: true,
      confirmPrivate: true,
    });
    expect(confirmed.status).toBe(200);
    expect(await assigneeOf(issue.id)).toBeNull();
    expect(await feedCount(world.alpha)).toBe(0);
  });

  it("needs no confirm when nobody loses anything", async () => {
    const response = await putTeam(world.owner, world.beta, {
      isPrivate: true,
    });
    expect(response.status).toBe(200);
  });
});

describe("private teams: an outsider asking for the team", () => {
  it("gets the same answer as for an unknown id", async () => {
    await setPrivate(world.owner, world.alpha);
    const ask = world.as(world.open);
    const unknown = await ask(`/project/${randomUUID()}`);
    const hidden = await ask(`/project/${world.alpha.id}`);
    expect(unknown.status).toBe(404);
    expect(hidden.status).toBe(unknown.status);
    expect(await hidden.json()).toEqual(await unknown.json());
    expect(
      (await world.as(world.limited)(`/project/${world.alpha.id}`)).status,
    ).toBe(200);
  });
});

describe("private teams: the member access endpoint", () => {
  beforeEach(async () => {
    await setPrivate(world.owner, world.alpha);
    mockAuthenticatedSession(world.owner);
  });
  const teamStatus = async (user: User, team: Team) =>
    (await world.as(user)(`/project/${team.id}`)).status;

  it("keeps a private team when a limited member is set to all", async () => {
    const saved = await putMemberProjectAccess(
      projectAccessApi(),
      world.ws,
      world.limited.id,
      { projectAccess: "all" },
    );
    expect(saved.status).toBe(200);
    expect(await grantsOf(world.limited)).toEqual([world.alpha.id]);
    expect(await teamStatus(world.limited, world.alpha)).toBe(200);
    expect(await teamStatus(world.limited, world.beta)).toBe(200);
  });

  it("adds no row for a private team named in a selection", async () => {
    const saved = await putMemberProjectAccess(
      projectAccessApi(),
      world.ws,
      world.open.id,
      {
        projectAccess: "selected",
        projectIds: [world.alpha.id, world.beta.id],
      },
    );
    expect(saved.status).toBe(200);
    expect(await grantsOf(world.open)).toEqual([world.beta.id]);
    expect(await teamStatus(world.open, world.beta)).toBe(200);
    expect(await teamStatus(world.open, world.alpha)).toBe(404);
  });

  it("removes nothing on a private team when a selection leaves it out", async () => {
    const saved = await putMemberProjectAccess(
      projectAccessApi(),
      world.ws,
      world.limited.id,
      { projectAccess: "selected", projectIds: [world.beta.id] },
    );
    expect(saved.status).toBe(200);
    expect(await grantsOf(world.limited)).toEqual(
      [world.alpha.id, world.beta.id].sort(),
    );
    expect(await teamStatus(world.limited, world.alpha)).toBe(200);
  });
});

describe("private teams: invitations", () => {
  it("does not put a new member into a team that became private", async () => {
    // This test signs real people in. The world built before each test leaves
    // a mocked session behind, which would answer for them.
    vi.restoreAllMocks();
    const ctx = await createInvitationWorkspace();
    const invited = await ctx.ownerRequest("/auth/organization/invite-member", {
      method: "POST",
      body: {
        organizationId: ctx.workspaceId,
        email: "client@example.com",
        role: "member",
        projectAccess: "selected",
        projectIds: [ctx.alpha.id, ctx.beta.id],
      },
    });
    expect(invited.status).toBe(200);
    const invitation = (await invited.json()) as { id: string };
    const flipped = await ctx.ownerRequest(`/project/${ctx.alpha.id}`, {
      method: "PUT",
      body: {
        name: ctx.alpha.name,
        icon: ctx.alpha.icon,
        slug: ctx.alpha.slug,
        description: ctx.alpha.description ?? "",
        isPublic: false,
        isPrivate: true,
      },
    });
    expect(flipped.status).toBe(200);

    const invitee = await signUpWithSession(ctx.app, {
      email: "client@example.com",
      name: "Client",
    });
    const inviteeRequest = projectAccessApi({ cookie: invitee.cookies });
    const accepted = await inviteeRequest(
      "/auth/organization/accept-invitation",
      { method: "POST", body: { invitationId: invitation.id } },
    );
    expect(accepted.status).toBe(200);

    const rows = await readMemberAccessRows(ctx.workspaceId, invitee.userId);
    expect(rows.grants.map((grant) => grant.projectId)).toEqual([ctx.beta.id]);
    expect((await inviteeRequest(`/project/${ctx.beta.id}`)).status).toBe(200);
    expect((await inviteeRequest(`/project/${ctx.alpha.id}`)).status).toBe(404);
  });
});

describe("private teams: private-members routes", () => {
  const members = (team: Team, userId: string) =>
    `/project/${team.id}/private-members/${userId}`;

  it("adds a person, who can then open the team", async () => {
    await setPrivate(world.owner, world.alpha);
    expect(
      (await world.as(world.open)(`/project/${world.alpha.id}`)).status,
    ).toBe(404);
    const added = await world.as(world.owner)(
      members(world.alpha, world.open.id),
      json("PUT"),
    );
    expect(added.status).toBe(200);
    const body = (await added.json()) as {
      projectId: string;
      userIds: string[];
    };
    expect(body.projectId).toBe(world.alpha.id);
    expect(body.userIds).toContain(world.open.id);
    expect(
      (await world.as(world.open)(`/project/${world.alpha.id}`)).status,
    ).toBe(200);
  });

  it("writes no row when the owner is added", async () => {
    await setPrivate(world.owner, world.alpha);
    const added = await world.as(world.owner)(
      members(world.alpha, world.owner.id),
      json("PUT"),
    );
    expect(added.status).toBe(200);
    expect(await grantsOf(world.owner)).toEqual([]);
    // The same route writes a row for a person who needs one.
    await world.as(world.owner)(
      members(world.alpha, world.open.id),
      json("PUT"),
    );
    expect(await grantsOf(world.open)).toEqual([world.alpha.id]);
  });

  it("removes a person, who loses the team and their issues in it", async () => {
    await setPrivate(world.owner, world.alpha);
    const issue = await addIssue(world.alpha, world.limited);
    expect(
      (await world.as(world.limited)(`/project/${world.alpha.id}`)).status,
    ).toBe(200);
    const removed = await world.as(world.owner)(
      members(world.alpha, world.limited.id),
      json("DELETE"),
    );
    expect(removed.status).toBe(200);
    expect(
      ((await removed.json()) as { userIds: string[] }).userIds,
    ).not.toContain(world.limited.id);
    expect(
      (await world.as(world.limited)(`/project/${world.alpha.id}`)).status,
    ).toBe(404);
    expect(await assigneeOf(issue.id)).toBeNull();
    expect(await unassignedBy(issue.id)).toEqual([world.owner.id]);
  });

  it("refuses a team that is not private", async () => {
    const add = () =>
      world.as(world.owner)(members(world.beta, world.open.id), json("PUT"));
    expect((await add()).status).toBe(400);
    await setPrivate(world.owner, world.beta);
    expect((await add()).status).toBe(200);
  });

  it("answers 404 for an unknown user and for someone outside the workspace", async () => {
    await setPrivate(world.owner, world.alpha);
    const add = (userId: string) =>
      world.as(world.owner)(members(world.alpha, userId), json("PUT"));
    const stranger = await createWorkspaceMember();
    expect((await add("no-such-user")).status).toBe(404);
    expect((await add(stranger.user.id)).status).toBe(404);
    expect((await add(world.open.id)).status).toBe(200);
  });

  it("answers a caller who cannot open the team like an unknown team", async () => {
    const admin = await addWorkspaceMember(world.ws, "admin");
    await setPrivate(world.owner, world.alpha);
    const add = (user: User) =>
      world.as(user)(members(world.alpha, world.open.id), json("PUT"));
    expect((await add(admin)).status).toBe(404);
    expect((await add(world.owner)).status).toBe(200);
  });

  it("lists only the private teams the caller can open", async () => {
    const admin = await addWorkspaceMember(world.ws, "admin");
    await setPrivate(world.owner, world.alpha);
    await setPrivate(admin, world.beta);
    const list = async (user: User) => {
      const response = await world.as(user)(
        `/workspace/${world.ws}/project-access/private`,
      );
      expect(response.status).toBe(200);
      return ((await response.json()) as { projectId: string }[])
        .map((row) => row.projectId)
        .sort();
    };
    expect(await list(world.owner)).toEqual(
      [world.alpha.id, world.beta.id].sort(),
    );
    expect(await list(admin)).toEqual([world.beta.id]);
  });
});

describe("private teams: paths with no person behind them", () => {
  it("serves no calendar feed while its team is private", async () => {
    const create = async (team: Team) =>
      world.as(world.owner)(
        `/calendar-feed/project/${team.id}`,
        json("POST", { timeZone: "UTC" }),
      );
    const response = await create(world.alpha);
    expect(response.status).toBe(201);
    const feed = (await response.json()) as { token: string };
    const fetchFeed = () => {
      mockAnonymousSession();
      return createApp().app.request(
        `/api/calendar-feed/${feed.token}/calendar.ics`,
      );
    };
    expect((await fetchFeed()).status).toBe(200);

    await setPrivate(world.owner, world.alpha);
    expect((await fetchFeed()).status).toBe(404);
    expect((await create(world.alpha)).status).toBe(400);
    expect((await create(world.beta)).status).toBe(201);
  });
});

describe("private teams: workspace webhooks", () => {
  beforeEach(() => {
    vi.stubEnv("NOTIFICATION_SECRET_ENCRYPTION_KEY", "webhook-test-key");
    vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "true");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("queues nothing for a private team and still queues for an open one", async () => {
    const hook = async (extra: Record<string, unknown> = {}) => {
      const response = await world.as(world.owner)(
        "/workspace-webhook",
        json("POST", {
          workspaceId: world.ws,
          label: "hook",
          url: "http://127.0.0.1:9/hook",
          resourceTypes: ["task"],
          ...extra,
        }),
      );
      expect(response.status).toBe(200);
    };
    await hook();
    await hook({ projectIds: [world.alpha.id] });
    const queued = async (task: { id: string }, team: Team) => {
      const before = (
        await db.select().from(schema.workspaceWebhookDeliveryTable)
      ).length;
      await publishEvent("task.updated", {
        taskId: task.id,
        projectId: team.id,
      });
      await settleEvents();
      return (
        (await db.select().from(schema.workspaceWebhookDeliveryTable)).length -
        before
      );
    };

    expect(await queued(world.alphaTask, world.alpha)).toBe(2);
    await setPrivate(world.owner, world.alpha);
    expect(await queued(world.alphaTask, world.alpha)).toBe(0);
    expect(await queued(world.betaTask, world.beta)).toBe(1);
  });
});

const told = async (user: User, type: string, resourceId?: string) =>
  (
    await db
      .select()
      .from(schema.notificationTable)
      .where(
        and(
          eq(schema.notificationTable.userId, user.id),
          eq(schema.notificationTable.type, type),
        ),
      )
  ).filter((row) => !resourceId || row.resourceId === resourceId);

describe("private teams: a stale grant on an invitation", () => {
  it("leaves a returning person with no row on the private team", async () => {
    vi.restoreAllMocks();
    const ctx = await createInvitationWorkspace();
    const invited = await ctx.ownerRequest("/auth/organization/invite-member", {
      method: "POST",
      body: {
        organizationId: ctx.workspaceId,
        email: "returning@example.com",
        role: "member",
        projectAccess: "selected",
        projectIds: [ctx.beta.id],
      },
    });
    expect(invited.status).toBe(200);
    const invitation = (await invited.json()) as { id: string };
    const flipped = await ctx.ownerRequest(`/project/${ctx.alpha.id}`, {
      method: "PUT",
      body: {
        name: ctx.alpha.name,
        icon: ctx.alpha.icon,
        slug: ctx.alpha.slug,
        description: ctx.alpha.description ?? "",
        isPublic: false,
        isPrivate: true,
      },
    });
    expect(flipped.status).toBe(200);

    const invitee = await signUpWithSession(ctx.app, {
      email: "returning@example.com",
      name: "Returning",
    });
    // A row left behind by an earlier membership.
    await db.insert(schema.workspaceMemberProjectTable).values({
      workspaceId: ctx.workspaceId,
      userId: invitee.userId,
      projectId: ctx.alpha.id,
    });
    const inviteeRequest = projectAccessApi({ cookie: invitee.cookies });
    const accepted = await inviteeRequest(
      "/auth/organization/accept-invitation",
      { method: "POST", body: { invitationId: invitation.id } },
    );
    expect(accepted.status).toBe(200);

    const rows = await readMemberAccessRows(ctx.workspaceId, invitee.userId);
    expect(rows.grants.map((grant) => grant.projectId)).toEqual([ctx.beta.id]);
    expect((await inviteeRequest(`/project/${ctx.beta.id}`)).status).toBe(200);
    expect((await inviteeRequest(`/project/${ctx.alpha.id}`)).status).toBe(404);
  });
});

describe("private teams: an older invitation for a current member", () => {
  it("keeps the member's private-team row when they accept it", async () => {
    vi.restoreAllMocks();
    const ctx = await createInvitationWorkspace();
    const invited = await ctx.ownerRequest("/auth/organization/invite-member", {
      method: "POST",
      body: {
        organizationId: ctx.workspaceId,
        email: "current@example.com",
        role: "member",
        projectAccess: "selected",
        projectIds: [ctx.beta.id],
      },
    });
    expect(invited.status).toBe(200);
    const invitation = (await invited.json()) as { id: string };
    const flipped = await ctx.ownerRequest(`/project/${ctx.alpha.id}`, {
      method: "PUT",
      body: {
        name: ctx.alpha.name,
        icon: ctx.alpha.icon,
        slug: ctx.alpha.slug,
        description: ctx.alpha.description ?? "",
        isPublic: false,
        isPrivate: true,
      },
    });
    expect(flipped.status).toBe(200);

    // They joined some other way since, chose team Beta, and were let into
    // the private team Alpha.
    const member = await signUpWithSession(ctx.app, {
      email: "current@example.com",
      name: "Current",
    });
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ctx.workspaceId,
      userId: member.userId,
      role: "member",
      joinedAt: new Date(),
    });
    await restrictToProjects(ctx.workspaceId, member.userId, [ctx.beta.id]);
    await db.insert(schema.workspaceMemberProjectTable).values({
      workspaceId: ctx.workspaceId,
      userId: member.userId,
      projectId: ctx.alpha.id,
    });
    const memberRequest = projectAccessApi({ cookie: member.cookies });
    expect((await memberRequest(`/project/${ctx.alpha.id}`)).status).toBe(200);

    await memberRequest("/auth/organization/accept-invitation", {
      method: "POST",
      body: { invitationId: invitation.id },
    });

    const rows = await readMemberAccessRows(ctx.workspaceId, member.userId);
    expect(rows.grants.map((grant) => grant.projectId).sort()).toEqual(
      [ctx.alpha.id, ctx.beta.id].sort(),
    );
    expect((await memberRequest(`/project/${ctx.alpha.id}`)).status).toBe(200);
    expect((await memberRequest(`/project/${ctx.beta.id}`)).status).toBe(200);
  });
});

describe("private teams: loops", () => {
  beforeEach(() => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    model.queue.length = 0;
    model.seen.length = 0;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fires only the loops whose creator can open the team", async () => {
    await setPrivate(world.owner, world.alpha);
    const [outside, inside] = await db
      .insert(schema.loopTable)
      .values(
        [world.open, world.limited].map((creator) => ({
          workspaceId: world.ws,
          creatorId: creator.id,
          name: `Watch ${creator.id}`,
          instructions: "Say hello",
          trigger: "task_created" as const,
        })),
      )
      .returning();
    model.queue.push(reply("done"), reply("done"));

    await publishEvent("task.created", {
      projectId: world.alpha.id,
      taskId: world.alphaTask.id,
    });
    await settleEvents();
    await vi.waitFor(async () => {
      const rows = await db.select().from(schema.loopRunTable);
      expect(rows.length).toBeGreaterThanOrEqual(1);
      expect(rows.every((row) => row.status !== "running")).toBe(true);
    });

    const runs = await db.select().from(schema.loopRunTable);
    expect(runs.map((run) => run.loopId)).toEqual([inside?.id]);
    expect(runs.some((run) => run.loopId === outside?.id)).toBe(false);
    expect(model.seen).toHaveLength(1);
  });
});

describe("private teams: loops listed and opened", () => {
  const post = (user: User, projectId?: string) =>
    world.as(user)(
      "/loop",
      json("POST", {
        workspaceId: world.ws,
        name: "Watch",
        instructions: "Say hello",
        trigger: "task_created",
        projectId,
      }),
    );
  const listed = async (user: User) =>
    (
      (await (
        await world.as(user)(`/loop/workspace/${world.ws}?scope=all`)
      ).json()) as { id: string }[]
    ).map((row) => row.id);

  it("keeps a private team's loops from people who cannot open it", async () => {
    await setPrivate(world.owner, world.alpha);
    const made = await post(world.owner, world.alpha.id);
    expect(made.status).toBe(200);
    const { id } = (await made.json()) as { id: string };
    const open = await post(world.owner);
    expect(open.status).toBe(200);
    const { id: openId } = (await open.json()) as { id: string };
    const url = `/loop/workspace/${world.ws}/${id}`;

    expect(await listed(world.open)).not.toContain(id);
    expect(await listed(world.open)).toContain(openId);
    expect((await world.as(world.open)(url)).status).toBe(404);
    expect((await world.as(world.open)(`${url}/runs`)).status).toBe(404);
    const unknown = await post(world.open, "no-such-team");
    const hidden = await post(world.open, world.alpha.id);
    expect(unknown.status).toBe(400);
    expect(hidden.status).toBe(unknown.status);
    expect(await hidden.text()).toBe(await unknown.text());

    expect(await listed(world.owner)).toContain(id);
    expect((await world.as(world.owner)(url)).status).toBe(200);
  });
});

describe("private teams: workspace webhooks on delete", () => {
  beforeEach(() => {
    vi.stubEnv("NOTIFICATION_SECRET_ENCRYPTION_KEY", "webhook-test-key");
    vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "true");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends no webhook when a private team is deleted", async () => {
    const created = await world.as(world.owner)(
      "/workspace-webhook",
      json("POST", {
        workspaceId: world.ws,
        label: "hook",
        url: "http://127.0.0.1:9/hook",
        resourceTypes: ["project"],
      }),
    );
    expect(created.status).toBe(200);
    const deliveries = async () =>
      JSON.stringify(
        await db.select().from(schema.workspaceWebhookDeliveryTable),
      );
    const remove = async (team: Team) => {
      const response = await world.as(world.owner)(
        `/project/${team.id}`,
        json("DELETE"),
      );
      expect(response.status).toBe(200);
      await settleEvents();
    };

    await remove(world.beta);
    expect(await deliveries()).toContain(world.beta.id);
    await setPrivate(world.owner, world.alpha);
    await remove(world.alpha);
    const after = await deliveries();
    expect(after).not.toContain(world.alpha.id);
    expect(after).not.toContain(world.alpha.name);
  });
});

describe("private teams: work projects", () => {
  // One work project on both teams, with an issue in each.
  const seedShared = async () => {
    const [shared] = await db
      .insert(schema.workProjectTable)
      .values({ workspaceId: world.ws, name: "Both teams" })
      .returning();
    await db.insert(schema.workProjectTeamTable).values([
      { workProjectId: shared.id, projectId: world.alpha.id },
      { workProjectId: shared.id, projectId: world.beta.id },
    ]);
    for (const team of [world.alpha, world.beta]) {
      await db.insert(schema.taskTable).values({
        projectId: team.id,
        title: "Counted",
        number: ++counter,
        workProjectId: shared.id,
      });
    }
    return shared;
  };
  const view = async (user: User, id: string) => {
    const response = await world.as(user)(
      `/work-project/workspace/${world.ws}`,
    );
    expect(response.status).toBe(200);
    const all = (await response.json()) as {
      id: string;
      teamIds: string[];
      progress: { total: number };
    }[];
    const found = all.find((row) => row.id === id);
    if (!found) throw new Error("The project is not listed");
    return { teamIds: found.teamIds.sort(), total: found.progress.total };
  };

  it("hides the team and its issues from someone outside it", async () => {
    const shared = await seedShared();
    await setPrivate(world.owner, world.alpha);

    expect(await view(world.owner, shared.id)).toEqual({
      teamIds: [world.alpha.id, world.beta.id].sort(),
      total: 2,
    });
    expect(await view(world.open, shared.id)).toEqual({
      teamIds: [world.beta.id],
      total: 1,
    });
  });

  it("answers an attach like an unknown team and keeps a hidden team on save", async () => {
    const shared = await seedShared();
    await setPrivate(world.owner, world.alpha);
    // Plain members cannot save work projects; an admin outside Alpha can.
    const admin = await addWorkspaceMember(world.ws, "admin");
    const create = (user: User, name: string, teamIds: string[]) =>
      world.as(user)(
        "/work-project",
        json("POST", { workspaceId: world.ws, name, teamIds }),
      );

    const unknown = await create(admin, "Unknown", ["no-such-team"]);
    const hidden = await create(admin, "Hidden", [world.alpha.id]);
    expect(unknown.status).toBe(400);
    expect(await unknown.text()).toContain(
      "Teams must belong to the workspace",
    );
    expect(hidden.status).toBe(unknown.status);
    expect(await hidden.text()).toContain("Teams must belong to the workspace");
    expect((await create(admin, "Visible", [world.beta.id])).status).toBe(200);
    expect((await create(world.owner, "Inside", [world.alpha.id])).status).toBe(
      200,
    );

    // The outsider saw only Beta, so saving that list leaves Alpha attached.
    const saved = await world.as(admin)(
      `/work-project/${shared.id}`,
      json("PUT", { teamIds: [world.beta.id] }),
    );
    expect(saved.status).toBe(200);
    expect(await view(world.owner, shared.id)).toMatchObject({
      teamIds: [world.alpha.id, world.beta.id].sort(),
    });
  });
});

describe("private teams: saved views", () => {
  const body = (teamId: string, name: string) =>
    json("POST", {
      workspaceId: world.ws,
      projectId: teamId,
      visibility: "shared",
      name,
      filters: {},
      display: {},
    });
  const listed = async (user: User) =>
    (
      (await (await world.as(user)(`/view/workspace/${world.ws}`)).json()) as {
        id: string;
      }[]
    ).map((row) => row.id);

  it("answers a create like an unknown team", async () => {
    await setPrivate(world.owner, world.alpha);
    const unknown = await world.as(world.open)(
      "/view",
      body("no-such-team", "A"),
    );
    const hidden = await world.as(world.open)(
      "/view",
      body(world.alpha.id, "B"),
    );
    expect(unknown.status).toBe(400);
    expect(await unknown.text()).toContain("Team not found");
    expect(hidden.status).toBe(unknown.status);
    expect(await hidden.text()).toContain("Team not found");
    expect(
      (await world.as(world.limited)("/view", body(world.alpha.id, "C")))
        .status,
    ).toBe(200);
  });

  it("keeps a shared view on the team from someone outside it", async () => {
    const created = await world.as(world.owner)(
      "/view",
      body(world.alpha.id, "Alpha work"),
    );
    expect(created.status).toBe(200);
    const { id } = (await created.json()) as { id: string };
    const get = (user: User) =>
      world.as(user)(`/view/workspace/${world.ws}/${id}`);
    expect(await listed(world.open)).toContain(id);
    expect((await get(world.open)).status).toBe(200);

    await setPrivate(world.owner, world.alpha);
    expect(await listed(world.open)).not.toContain(id);
    expect((await get(world.open)).status).toBe(404);
    expect(await listed(world.limited)).toContain(id);
    expect((await get(world.limited)).status).toBe(200);
  });
});

describe("private teams: reminders and SLA", () => {
  const DAY_MS = 86_400_000;
  it("sends a due-date reminder only to an assignee who can open the team", async () => {
    await setPrivate(world.owner, world.alpha);
    const due = new Date(
      Date.now() + DAY_MS - 5 * 60_000 - DUE_DATE_DURATION_MS,
    );
    const outside = await addIssue(world.alpha, world.open, "Outside");
    const inside = await addIssue(world.alpha, world.limited, "Inside");
    await db
      .update(schema.taskTable)
      .set({ dueDate: due })
      .where(eq(schema.taskTable.id, outside.id));
    await db
      .update(schema.taskTable)
      .set({ dueDate: due })
      .where(eq(schema.taskTable.id, inside.id));

    await checkDueDateReminders();

    expect(
      await told(world.limited, "due_date_reminder", inside.id),
    ).toHaveLength(1);
    expect(await told(world.open, "due_date_reminder", outside.id)).toEqual([]);
  });

  it("sends an SLA notice for an unassigned issue only to a triager who can open the team", async () => {
    await setPrivate(world.owner, world.alpha);
    const now = new Date("2026-06-01T12:00:00Z");
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: world.alpha.id,
        title: "Unowned",
        number: ++counter,
        slaDueAt: new Date(now.getTime() + 30 * 60_000),
      })
      .returning();
    await db.insert(projectTriageResponsibleTable).values(
      [world.open, world.limited].map((user) => ({
        projectId: world.alpha.id,
        userId: user.id,
      })),
    );

    await checkSlaNotifications(now);

    expect(await told(world.limited, "sla_warning", task.id)).toHaveLength(1);
    expect(await told(world.open, "sla_warning", task.id)).toEqual([]);
  });
});

describe("private teams: naming a private team in a selection", () => {
  it("answers an admin outside the team like an unknown id", async () => {
    await setPrivate(world.owner, world.alpha);
    const admin = await addWorkspaceMember(world.ws, "admin");
    const select = (user: User, projectIds: string[]) =>
      world.as(user)(
        `/workspace/${world.ws}/members/${world.open.id}/project-access`,
        json("PUT", { projectAccess: "selected", projectIds }),
      );

    const unknown = await select(admin, ["no-such-team"]);
    const hidden = await select(admin, [world.alpha.id]);
    expect(unknown.status).toBe(400);
    expect(hidden.status).toBe(unknown.status);
    const hiddenText = await hidden.text();
    expect(hiddenText).toBe(await unknown.text());
    expect(hiddenText).not.toContain(world.alpha.id);

    // Someone inside the team naming it is not refused.
    expect((await select(world.owner, [world.alpha.id])).status).toBe(200);
  });

  it("lets an admin outside the team select a team they can open", async () => {
    await setPrivate(world.owner, world.alpha);
    const admin = await addWorkspaceMember(world.ws, "admin");
    const saved = await world.as(admin)(
      `/workspace/${world.ws}/members/${world.limited.id}/project-access`,
      json("PUT", { projectAccess: "selected", projectIds: [world.beta.id] }),
    );
    expect([saved.status, await saved.text()]).toEqual([
      200,
      expect.anything(),
    ]);
    expect(await grantsOf(world.limited)).toEqual(
      [world.alpha.id, world.beta.id].sort(),
    );
  });
});

describe("private teams: topic followers and documents", () => {
  it("does not tell a follower who lost the team about a proposal", async () => {
    const topicResponse = await world.as(world.owner)(
      "/topic",
      json("POST", {
        workspaceId: world.ws,
        name: "Pricing",
        projectId: world.alpha.id,
      }),
    );
    expect(topicResponse.status).toBe(200);
    const topic = (await topicResponse.json()) as { id: string };
    await setPrivate(world.owner, world.alpha);
    await db
      .insert(topicSubscriberTable)
      .values(
        [world.open, world.limited].map((user) => ({
          topicId: topic.id,
          userId: user.id,
        })),
      )
      .onConflictDoNothing();

    const written = await world.as(world.owner)(
      "/document",
      json("POST", {
        workspaceId: world.ws,
        title: "Pricing for next year",
        content: "<p>Pricing</p>",
      }),
    );
    expect(written.status).toBe(200);
    const { id: documentId } = (await written.json()) as { id: string };
    const filed = await world.as(world.owner)(
      `/topic/workspace/${world.ws}/${topic.id}/document/${documentId}`,
      json("PUT"),
    );
    expect(filed.status).toBe(200);

    expect(await told(world.limited, "document_proposed")).toHaveLength(1);
    expect(await told(world.open, "document_proposed")).toEqual([]);
  });
});

describe("private teams: files on a document", () => {
  it("serves the file to a member and answers an outsider like an unknown file", async () => {
    await setPrivate(world.owner, world.alpha);
    const [file] = await db
      .insert(schema.assetTable)
      .values({
        workspaceId: world.ws,
        documentId: world.docs.teamAlpha,
        objectKey: randomUUID(),
        filename: "notes.pdf",
        mimeType: "application/pdf",
        size: 3,
        kind: "attachment",
        surface: "document",
        createdBy: world.owner.id,
      })
      .returning();

    expect((await world.as(world.limited)(`/asset/${file.id}`)).status).toBe(
      200,
    );
    expect((await world.as(world.owner)(`/asset/${file.id}`)).status).toBe(200);
    const unknown = await world.as(world.open)("/asset/no-such-file");
    const hidden = await world.as(world.open)(`/asset/${file.id}`);
    expect(unknown.status).toBe(404);
    expect(hidden.status).toBe(unknown.status);
    expect(await hidden.json()).toEqual(await unknown.json());
  });
});

describe("private teams: moving a team", () => {
  it("keeps the person who moves a private team in it", async () => {
    const admin = await addWorkspaceMember(world.ws, "admin");
    await setPrivate(admin, world.alpha);
    const [target] = await db
      .insert(schema.workspaceTable)
      .values({
        id: `workspace-${randomUUID()}`,
        createdAt: new Date(),
        name: "Target",
        slug: `target-${randomUUID()}`,
      })
      .returning();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: target.id,
      userId: admin.id,
      role: "admin",
      joinedAt: new Date(),
    });

    const moved = await world.as(admin)(
      `/project/${world.alpha.id}/move`,
      json("PUT", { workspaceId: target.id }),
    );
    expect(moved.status).toBe(200);

    const rows = await readMemberAccessRows(target.id, admin.id);
    expect(rows.grants.map((grant) => grant.projectId)).toEqual([
      world.alpha.id,
    ]);
    expect((await world.as(admin)(`/project/${world.alpha.id}`)).status).toBe(
      200,
    );
  });
});

describe("private teams: pull request links", () => {
  it("links an issue in the team for a member and for nobody outside", async () => {
    await setPrivate(world.owner, world.alpha);
    const url = "https://github.com/acme/web/pull/7";
    await db.insert(schema.externalLinkTable).values({
      taskId: world.alphaTask.id,
      resourceType: "pull_request",
      externalId: "7",
      url,
    });

    const seenBy = async (user: User) =>
      (await findLinkedIssues(user.id, [url])).get(url)?.taskId;
    expect(await seenBy(world.limited)).toBe(world.alphaTask.id);
    expect(await seenBy(world.owner)).toBe(world.alphaTask.id);
    expect(await seenBy(world.open)).toBeUndefined();
  });
});
