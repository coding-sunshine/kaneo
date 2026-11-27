import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import "../../apps/api/src/activity";
import db, { schema } from "../../apps/api/src/database";
import { settleEvents } from "../../apps/api/src/events";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";

type DoneTasksResponse = {
  tasks: Array<{ id: string; title: string; projectName: string }>;
};

const weekStart = () => new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

async function setup() {
  const a = await createWorkspaceMember();
  const b = await createWorkspaceMember();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId: a.workspace.id,
    userId: b.user.id,
    role: "member",
    joinedAt: new Date(),
  });
  const { project, columns } = await createProjectFixture({
    workspaceId: a.workspace.id,
    name: "Web",
  });
  let number = 0;
  const task = async (
    title: string,
    values: Partial<typeof schema.taskTable.$inferInsert> = {},
  ) => {
    number += 1;
    const [row] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title,
        status: "to-do",
        columnId: columns.todo.id,
        priority: "low",
        number,
        position: number,
        ...values,
      })
      .returning();
    return row;
  };
  return { a, b, project, columns, task };
}

async function complete(userId: string, taskId: string) {
  const { app } = createApp();
  const user = await db.query.userTable.findFirst({
    where: eq(schema.userTable.id, userId),
  });
  if (!user) throw new Error("missing user");
  mockAuthenticatedSession(user);
  const response = await app.request(`/api/task/status/${taskId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "done" }),
  });
  expect(response.status).toBe(200);
  await settleEvents();
}

async function listDone(
  user: typeof schema.userTable.$inferSelect,
  workspaceId: string,
  since = weekStart(),
) {
  mockAuthenticatedSession(user);
  const { app } = createApp();
  return app.request(
    `/api/task/done?workspaceId=${workspaceId}&since=${encodeURIComponent(since.toISOString())}`,
  );
}

async function doneTitles(
  user: typeof schema.userTable.$inferSelect,
  workspaceId: string,
  since?: Date,
) {
  const response = await listDone(user, workspaceId, since);
  expect(response.status).toBe(200);
  const body = (await response.json()) as DoneTasksResponse;
  return body.tasks.map((task) => task.title);
}

describe("API integration: done this week", () => {
  beforeEach(resetTestDatabase);

  it("lists the tasks the caller completed this week, to the caller only", async () => {
    const { a, b, task } = await setup();
    const first = await task("Ship the login page");
    const second = await task("Fix the footer", { userId: b.user.id });
    await task("Still open");

    await complete(a.user.id, first.id);
    await complete(a.user.id, second.id);

    expect((await doneTitles(a.user, a.workspace.id)).sort()).toEqual([
      "Fix the footer",
      "Ship the login page",
    ]);
    expect(await doneTitles(b.user, a.workspace.id)).toEqual([]);
  });

  it("credits the user who completed the task, not a later move within done", async () => {
    const { a, b, task, columns } = await setup();
    const first = await task("Write the release notes");
    await complete(a.user.id, first.id);
    await db.insert(schema.activityTable).values({
      taskId: first.id,
      type: "status_changed",
      userId: b.user.id,
      eventData: { oldStatus: "done", newStatus: "done" },
      createdAt: new Date(Date.now() + 60_000),
    });

    expect(await doneTitles(a.user, a.workspace.id)).toEqual([
      "Write the release notes",
    ]);
    expect(await doneTitles(b.user, a.workspace.id)).toEqual([]);
    expect(columns.done.isFinal).toBe(true);
  });

  it("leaves out tasks completed before the week started, and reopened ones", async () => {
    const { a, task } = await setup();
    const earlier = await task("Done last week");
    const reopened = await task("Reopened");
    await complete(a.user.id, earlier.id);
    await complete(a.user.id, reopened.id);

    const { app } = createApp();
    const response = await app.request(`/api/task/status/${reopened.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "to-do" }),
    });
    expect(response.status).toBe(200);
    await settleEvents();

    const [row] = await db
      .select({ completedAt: schema.taskTable.completedAt })
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, earlier.id));
    if (!row?.completedAt) throw new Error("task was not stamped completed");

    expect(
      await doneTitles(a.user, a.workspace.id, new Date(row.completedAt)),
    ).toEqual(["Done last week"]);
    expect(
      await doneTitles(
        a.user,
        a.workspace.id,
        new Date(row.completedAt.getTime() + 1),
      ),
    ).toEqual([]);
  });

  it("hides completions in projects the caller can no longer open", async () => {
    const { a, task } = await setup();
    const other = await createProjectFixture({
      workspaceId: a.workspace.id,
      name: "Private",
    });
    const visible = await task("Visible");
    const hidden = await task("Hidden", {
      projectId: other.project.id,
      columnId: other.columns.todo.id,
    });
    await complete(a.user.id, visible.id);
    await complete(a.user.id, hidden.id);

    await restrictToProjects(a.workspace.id, a.user.id, [visible.projectId]);

    expect(await doneTitles(a.user, a.workspace.id)).toEqual(["Visible"]);
  });

  it("keeps each workspace's completions to that workspace", async () => {
    const { a, task } = await setup();
    const elsewhere = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: elsewhere.workspace.id,
      userId: a.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    const done = await task("In the first workspace");
    await complete(a.user.id, done.id);

    expect(await doneTitles(a.user, elsewhere.workspace.id)).toEqual([]);
  });

  it("refuses anonymous callers", async () => {
    const { a } = await setup();
    mockAnonymousSession();
    const { app } = createApp();
    const response = await app.request(
      `/api/task/done?workspaceId=${a.workspace.id}&since=${encodeURIComponent(weekStart().toISOString())}`,
    );
    expect(response.status).toBe(401);
  });

  it("refuses a workspace the caller does not belong to", async () => {
    const { a } = await setup();
    const outsider = await createWorkspaceMember();
    const response = await listDone(outsider.user, a.workspace.id);
    expect(response.status).toBe(404);
  });

  it.each([
    { workspace: ["read"] },
    { workspace: ["read"], project: ["read"] },
    { workspace: ["read"], task: ["read"] },
  ])(
    "rejects members missing project or task read permission (%j)",
    async (permissions) => {
      const member = await createWorkspaceMember({ role: "limited" });
      await db.insert(schema.workspaceRoleTable).values({
        workspaceId: member.workspace.id,
        role: "limited",
        permission: JSON.stringify(permissions),
      });
      const response = await listDone(member.user, member.workspace.id);
      expect(response.status).toBe(403);
    },
  );

  it("rejects a missing or malformed since", async () => {
    const { a } = await setup();
    mockAuthenticatedSession(a.user);
    const { app } = createApp();
    for (const query of ["", "&since=yesterday"]) {
      const response = await app.request(
        `/api/task/done?workspaceId=${a.workspace.id}${query}`,
      );
      expect(response.status).toBe(400);
    }
  });
});
