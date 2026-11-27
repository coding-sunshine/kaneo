import { and, eq } from "drizzle-orm";
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
import { checkStaleItemNudges } from "../../apps/api/src/scheduler/stale-item-nudges";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(resetTestDatabase);
afterEach(() => vi.restoreAllMocks());

// A Monday; the following Saturday and Sunday are 5 and 6 days later.
const MONDAY = new Date("2026-11-30T10:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const days = (n: number) => new Date(MONDAY.getTime() + n * DAY_MS);

async function world() {
  const owner = await createWorkspaceMember();
  const { project, columns } = await createProjectFixture({
    workspaceId: owner.workspace.id,
  });
  const other = await createWorkspaceMember();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId: owner.workspace.id,
    userId: other.user.id,
    role: "member",
    joinedAt: new Date(),
  });
  return { owner, other, project, columns };
}

// A task that moved into its current status `inStatusDays` days before Monday.
async function taskInStatus(
  w: Awaited<ReturnType<typeof world>>,
  opts: {
    inStatusDays: number;
    status?: "in-review" | "in-progress" | "to-do" | "done";
    assignee?: string | null;
    creator?: string;
    number?: number;
  },
) {
  const status = opts.status ?? "in-review";
  const column = {
    "in-review": w.columns.inReview,
    "in-progress": w.columns.inProgress,
    "to-do": w.columns.todo,
    done: w.columns.done,
  }[status];
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: w.project.id,
      title: "Waiting on review",
      number: opts.number ?? 1,
      status,
      columnId: column.id,
      userId: opts.assignee === undefined ? w.owner.user.id : opts.assignee,
      creatorId: opts.creator,
      createdAt: days(-30),
    })
    .returning();
  await db.insert(schema.activityTable).values({
    taskId: task.id,
    type: "status_changed",
    userId: w.owner.user.id,
    eventData: { oldStatus: "in-progress", newStatus: status },
    createdAt: days(-opts.inStatusDays),
  });
  return task;
}

async function lines(userId: string) {
  return db
    .select()
    .from(schema.notificationTable)
    .where(
      and(
        eq(schema.notificationTable.userId, userId),
        eq(schema.notificationTable.type, "stale_items"),
      ),
    );
}

describe("stale item nudge", () => {
  it("sends the owner one line listing an issue in review for over a week", async () => {
    const w = await world();
    const task = await taskInStatus(w, { inStatusDays: 8 });

    await checkStaleItemNudges(MONDAY);

    const sent = await lines(w.owner.user.id);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      type: "stale_items",
      resourceType: "workspace",
      resourceId: w.owner.workspace.id,
    });
    expect(sent[0].eventData).toMatchObject({
      count: 1,
      tasks: [
        {
          id: task.id,
          title: "Waiting on review",
          status: "in-review",
          days: 8,
        },
      ],
    });
  });

  it("lists every stale issue of the owner in the one line", async () => {
    const w = await world();
    await taskInStatus(w, { inStatusDays: 8, number: 1 });
    await taskInStatus(w, {
      inStatusDays: 12,
      status: "in-progress",
      number: 2,
    });

    await checkStaleItemNudges(MONDAY);

    const sent = await lines(w.owner.user.id);
    expect(sent).toHaveLength(1);
    expect(sent[0].eventData).toMatchObject({ count: 2 });
  });

  it("sends once a week, not on every run", async () => {
    const w = await world();
    await taskInStatus(w, { inStatusDays: 8 });

    await checkStaleItemNudges(MONDAY);
    await checkStaleItemNudges(days(0.01));
    await checkStaleItemNudges(days(1));
    await checkStaleItemNudges(days(4));
    expect(await lines(w.owner.user.id)).toHaveLength(1);

    await checkStaleItemNudges(days(7));
    expect(await lines(w.owner.user.id)).toHaveLength(2);
  });

  it("keeps the issue on the list after someone comments on it", async () => {
    const w = await world();
    const task = await taskInStatus(w, { inStatusDays: 8 });
    await createComment(task.id, w.other.user.id, "Any news?");

    await checkStaleItemNudges(MONDAY);

    const sent = await lines(w.owner.user.id);
    expect(sent).toHaveLength(1);
    expect(sent[0].eventData).toMatchObject({ tasks: [{ id: task.id }] });
  });

  it("sends nothing on a Saturday or a Sunday", async () => {
    const w = await world();
    await taskInStatus(w, { inStatusDays: 8 });

    await checkStaleItemNudges(days(5));
    await checkStaleItemNudges(days(6));

    expect(await lines(w.owner.user.id)).toEqual([]);
  });

  it("follows the owner's timezone for the weekend", async () => {
    const w = await world();
    await taskInStatus(w, { inStatusDays: 8 });
    await db.insert(schema.userNotificationPreferenceTable).values({
      userId: w.owner.user.id,
      scheduleTimezone: "America/Los_Angeles",
    });

    // Monday 05:00 UTC is still Sunday evening in Los Angeles.
    await checkStaleItemNudges(new Date("2026-11-30T05:00:00Z"));
    expect(await lines(w.owner.user.id)).toEqual([]);

    // Saturday 04:00 UTC is still Friday evening there.
    await checkStaleItemNudges(new Date("2026-12-05T04:00:00Z"));
    expect(await lines(w.owner.user.id)).toHaveLength(1);
  });

  it("leaves out issues that moved within the week, are done, or are not started", async () => {
    const w = await world();
    await taskInStatus(w, { inStatusDays: 6, number: 1 });
    await taskInStatus(w, { inStatusDays: 20, status: "done", number: 2 });
    await taskInStatus(w, { inStatusDays: 20, status: "to-do", number: 3 });
    const archived = await taskInStatus(w, { inStatusDays: 20, number: 4 });
    await db
      .update(schema.taskTable)
      .set({ archivedAt: days(-1) })
      .where(eq(schema.taskTable.id, archived.id));

    await checkStaleItemNudges(MONDAY);

    expect(await lines(w.owner.user.id)).toEqual([]);
  });

  it("measures from the latest status change, not from creation", async () => {
    const w = await world();
    const task = await taskInStatus(w, { inStatusDays: 20 });
    await db.insert(schema.activityTable).values({
      taskId: task.id,
      type: "status_changed",
      userId: w.owner.user.id,
      eventData: { oldStatus: "in-progress", newStatus: "in-review" },
      createdAt: days(-2),
    });

    await checkStaleItemNudges(MONDAY);

    expect(await lines(w.owner.user.id)).toEqual([]);
  });

  it("tells only the assignee: not the creator, other members or anyone for an unassigned issue", async () => {
    const w = await world();
    await taskInStatus(w, {
      inStatusDays: 8,
      creator: w.other.user.id,
      number: 1,
    });
    await taskInStatus(w, { inStatusDays: 8, assignee: null, number: 2 });

    await checkStaleItemNudges(MONDAY);

    expect(await lines(w.owner.user.id)).toHaveLength(1);
    expect(await lines(w.other.user.id)).toEqual([]);
    const all = await db.select().from(schema.notificationTable);
    expect(all).toHaveLength(1);
  });

  it("tells nobody about an issue the owner can no longer open", async () => {
    const w = await world();
    await taskInStatus(w, { inStatusDays: 8 });
    await db
      .update(schema.projectTable)
      .set({ isPrivate: true })
      .where(eq(schema.projectTable.id, w.project.id));

    await checkStaleItemNudges(MONDAY);

    expect(await db.select().from(schema.notificationTable)).toEqual([]);
  });

  it("tells nobody once the owner has left the workspace", async () => {
    const w = await world();
    await taskInStatus(w, { inStatusDays: 8 });
    await db
      .delete(schema.workspaceUserTable)
      .where(eq(schema.workspaceUserTable.userId, w.owner.user.id));

    await checkStaleItemNudges(MONDAY);

    expect(await db.select().from(schema.notificationTable)).toEqual([]);
  });

  it("tells nobody about an archived workspace", async () => {
    const w = await world();
    await taskInStatus(w, { inStatusDays: 8 });
    await db
      .update(schema.workspaceTable)
      .set({ archivedAt: days(-1) })
      .where(eq(schema.workspaceTable.id, w.owner.workspace.id));

    await checkStaleItemNudges(MONDAY);

    expect(await db.select().from(schema.notificationTable)).toEqual([]);
  });

  it("keeps the line out of the owner's other workspaces", async () => {
    const w = await world();
    await taskInStatus(w, { inStatusDays: 8 });
    await checkStaleItemNudges(MONDAY);
    const { app } = createApp();
    mockAuthenticatedSession(w.owner.user);

    const here = await app.request(
      `/api/notification?workspaceId=${w.owner.workspace.id}`,
    );
    expect(
      ((await here.json()) as { type: string }[]).map((n) => n.type),
    ).toEqual(["stale_items"]);

    // The owner's second membership: the workspace that came with `other`.
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: w.other.workspace.id,
      userId: w.owner.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    const elsewhere = await app.request(
      `/api/notification?workspaceId=${w.other.workspace.id}`,
    );
    expect(elsewhere.status).toBe(200);
    expect(await elsewhere.json()).toEqual([]);
  });

  it("shows the line in the owner's inbox and in nobody else's", async () => {
    const w = await world();
    await taskInStatus(w, { inStatusDays: 8 });
    await checkStaleItemNudges(MONDAY);
    const { app } = createApp();

    mockAuthenticatedSession(w.owner.user);
    const mine = await app.request("/api/notification");
    expect(mine.status).toBe(200);
    expect(
      ((await mine.json()) as { type: string }[]).map((n) => n.type),
    ).toEqual(["stale_items"]);

    mockAuthenticatedSession(w.other.user);
    const theirs = await app.request("/api/notification");
    expect(theirs.status).toBe(200);
    expect(await theirs.json()).toEqual([]);
  });

  it("sends nothing to an owner who turned the nudge off, and resumes when turned back on", async () => {
    const w = await world();
    await taskInStatus(w, { inStatusDays: 8 });
    const { app } = createApp();
    mockAuthenticatedSession(w.owner.user);
    const put = (staleItemsEnabled: boolean) =>
      app.request("/api/notification-preferences", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:5173",
        },
        body: JSON.stringify({ staleItemsEnabled }),
      });

    const off = await put(false);
    expect(off.status).toBe(200);
    expect(await off.json()).toMatchObject({ staleItemsEnabled: false });
    await checkStaleItemNudges(MONDAY);
    expect(await lines(w.owner.user.id)).toEqual([]);

    const on = await put(true);
    expect(on.status).toBe(200);
    await checkStaleItemNudges(days(1));
    expect(await lines(w.owner.user.id)).toHaveLength(1);
  });
});
