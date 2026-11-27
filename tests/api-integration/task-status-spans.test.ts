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

type SpansResponse = {
  spans: Array<{
    status: string;
    name: string | null;
    totalMs: number;
    current: boolean;
  }>;
};

const HOUR = 3_600_000;

async function setup() {
  const member = await createWorkspaceMember();
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Review the release",
      status: "to-do",
      columnId: columns.todo.id,
      priority: "low",
      number: 1,
      position: 1,
      createdAt: new Date(Date.now() - 5 * HOUR),
    })
    .returning();
  if (!task) throw new Error("missing task");
  return { member, project, columns, task };
}

async function spansOf(
  user: typeof schema.userTable.$inferSelect,
  taskId: string,
) {
  mockAuthenticatedSession(user);
  const { app } = createApp();
  return app.request(`/api/task/${taskId}/status-spans`);
}

async function move(
  user: typeof schema.userTable.$inferSelect,
  taskId: string,
  status: string,
) {
  mockAuthenticatedSession(user);
  const { app } = createApp();
  const response = await app.request(`/api/task/status/${taskId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  expect(response.status).toBe(200);
  await settleEvents();
}

describe("API integration: time in status", () => {
  beforeEach(resetTestDatabase);

  it("returns when the task completed, so the web app can celebrate it", async () => {
    const { member, task } = await setup();
    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const put = (status: string) =>
      app.request(`/api/task/status/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    const open = await (await put("in-progress")).json();
    expect(open.completedAt).toBeNull();
    const done = await (await put("done")).json();
    expect(typeof done.completedAt).toBe("string");
  });

  it("reports cumulative time per status from status changes", async () => {
    const { member, task } = await setup();
    await move(member.user, task.id, "in-progress");
    await move(member.user, task.id, "in-review");

    const response = await spansOf(member.user, task.id);
    expect(response.status).toBe(200);
    const { spans } = (await response.json()) as SpansResponse;

    expect(
      spans.map(({ status, name, current }) => [status, name, current]),
    ).toEqual([
      ["to-do", "To Do", false],
      ["in-progress", "In Progress", false],
      ["in-review", "In Review", true],
    ]);
    expect(spans[0]?.totalMs).toBeGreaterThanOrEqual(5 * HOUR - 60_000);
  });

  it("still reports spans after a column slug is renamed", async () => {
    const { member, task, columns } = await setup();
    await db.insert(schema.activityTable).values({
      taskId: task.id,
      type: "status_changed",
      userId: member.user.id,
      eventData: { oldStatus: "to-do", newStatus: "in-review" },
      createdAt: new Date(Date.now() - 2 * HOUR),
    });
    await db
      .update(schema.columnTable)
      .set({ slug: "review" })
      .where(eq(schema.columnTable.id, columns.inReview.id));
    await db
      .update(schema.taskTable)
      .set({ status: "review", columnId: columns.inReview.id })
      .where(eq(schema.taskTable.id, task.id));

    const response = await spansOf(member.user, task.id);
    expect(response.status).toBe(200);
    const { spans } = (await response.json()) as SpansResponse;

    expect(
      spans.map(({ status, name, current }) => [status, name, current]),
    ).toEqual([
      ["to-do", "To Do", false],
      ["review", "In Review", true],
    ]);
    expect(spans[1]?.totalMs).toBeGreaterThanOrEqual(2 * HOUR - 60_000);
  });

  it("refuses anonymous callers", async () => {
    const { task } = await setup();
    mockAnonymousSession();
    const { app } = createApp();
    const response = await app.request(`/api/task/${task.id}/status-spans`);
    expect(response.status).toBe(401);
  });

  it("hides tasks in other workspaces", async () => {
    const { task } = await setup();
    const outsider = await createWorkspaceMember();
    const response = await spansOf(outsider.user, task.id);
    expect(response.status).toBe(404);
  });

  it("refuses members without access to the task's project", async () => {
    const { member, task } = await setup();
    const other = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    await restrictToProjects(member.workspace.id, member.user.id, [
      other.project.id,
    ]);
    const response = await spansOf(member.user, task.id);
    expect(response.status).toBe(403);
  });

  it("refuses members whose role lacks task:read", async () => {
    const member = await createWorkspaceMember({ role: "limited" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: member.workspace.id,
      role: "limited",
      permission: JSON.stringify({ project: ["read"] }),
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({ projectId: project.id, title: "Hidden", number: 1 })
      .returning();
    if (!task) throw new Error("missing task");

    const response = await spansOf(member.user, task.id);
    expect(response.status).toBe(403);
  });
});
