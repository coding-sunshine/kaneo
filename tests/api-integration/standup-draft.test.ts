import { count, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import "../../apps/api/src/activity";
import db, { schema } from "../../apps/api/src/database";
import * as events from "../../apps/api/src/events";
import { settleEvents } from "../../apps/api/src/events";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";

type User = typeof schema.userTable.$inferSelect;
type Item = { id: string; title: string; ticket: string; projectId: string };
type Draft = { did: Item[]; doing: Item[]; blocked: Item[] };

async function setup() {
  const a = await createWorkspaceMember();
  const b = await createWorkspaceMember();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId: a.workspace.id,
    userId: b.user.id,
    role: "member",
    joinedAt: new Date(),
  });
  const web = await createProjectFixture({
    workspaceId: a.workspace.id,
    slug: "web",
  });
  let number = 0;
  const task = async (
    title: string,
    values: Partial<typeof schema.taskTable.$inferInsert> = {},
    project = web,
  ) => {
    number += 1;
    const [row] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.project.id,
        title,
        status: "to-do",
        columnId: project.columns.todo.id,
        number,
        ...values,
      })
      .returning();
    return row;
  };
  return { a, b, web, task, ws: a.workspace.id };
}

const { app } = createApp();

async function setStatus(user: User, taskId: string, status: string) {
  mockAuthenticatedSession(user);
  const response = await app.request(`/api/task/status/${taskId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  expect(response.status).toBe(200);
  await settleEvents();
}

async function draft(user: User, workspaceId: string, days = 1) {
  mockAuthenticatedSession(user);
  const response = await app.request(
    `/api/standup/workspace/${workspaceId}/draft?days=${days}`,
  );
  return response;
}

const titles = (items: Item[]) => items.map((item) => item.title).sort();

describe("API integration: private standup draft", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("lists only the caller's own did, doing and blocked tickets, with ticket keys", async () => {
    const { a, b, task, ws, web } = await setup();
    const shipped = await task("Ship login", { userId: a.user.id });
    await setStatus(a.user, shipped.id, "done");
    await task("Fix footer", {
      userId: a.user.id,
      status: "in-progress",
      columnId: web.columns.inProgress.id,
      startedAt: new Date(),
    });
    const stuck = await task("Wire payments", { userId: a.user.id });
    const blocker = await task("Vendor contract", { userId: b.user.id });
    await db.insert(schema.taskRelationTable).values({
      sourceTaskId: blocker.id,
      targetTaskId: stuck.id,
      relationType: "blocks",
    });
    // Another person's work never shows in my draft.
    const theirs = await task("Their release", { userId: b.user.id });
    await setStatus(b.user, theirs.id, "done");
    await task("Their review", {
      userId: b.user.id,
      status: "in-progress",
      columnId: web.columns.inProgress.id,
      startedAt: new Date(),
    });

    const response = await draft(a.user, ws);
    expect(response.status, await response.clone().text()).toBe(200);
    const body = (await response.json()) as Draft;
    expect(titles(body.did)).toEqual(["Ship login"]);
    expect(titles(body.doing)).toEqual(["Fix footer"]);
    expect(titles(body.blocked)).toEqual(["Wire payments"]);
    expect(body.did[0]).toMatchObject({
      id: shipped.id,
      projectId: web.project.id,
      ticket: `WEB-${shipped.number}`,
    });
    const all = JSON.stringify(body);
    expect(all).not.toContain("Their");
    expect(all).not.toContain(b.user.id);
  });

  it("leaves out tickets in a team the caller cannot open", async () => {
    const { a, task, ws, web } = await setup();
    const hidden = await createProjectFixture({ workspaceId: ws });
    await task(
      "Secret work",
      {
        userId: a.user.id,
        status: "in-progress",
        columnId: hidden.columns.inProgress.id,
        startedAt: new Date(),
      },
      hidden,
    );
    await restrictToProjects(ws, a.user.id, [web.project.id]);
    const body = (await (await draft(a.user, ws)).json()) as Draft;
    expect(JSON.stringify(body)).not.toContain("Secret work");
  });

  it("refuses a workspace the caller is not a member of", async () => {
    const { ws } = await setup();
    const stranger = await createWorkspaceMember();
    expect((await draft(stranger.user, ws)).status).toBe(404);
  });

  it("counts completions within the chosen window only", async () => {
    const { a, task, ws, web } = await setup();
    await task("Old win", {
      userId: a.user.id,
      status: "done",
      columnId: web.columns.done.id,
      completedAt: new Date(Date.now() - 3 * 86_400_000),
    });
    const fresh = await task("New win", { userId: a.user.id });
    await setStatus(a.user, fresh.id, "done");
    const day = (await (await draft(a.user, ws, 1)).json()) as Draft;
    expect(titles(day.did)).toEqual(["New win"]);
    expect((await draft(a.user, ws, 30)).status).toBe(400);
  });

  it("stores, publishes and notifies nothing", async () => {
    const { a, task, ws } = await setup();
    const shipped = await task("Ship login", { userId: a.user.id });
    await setStatus(a.user, shipped.id, "done");
    const rows = async () => ({
      notifications: (
        await db.select({ n: count() }).from(schema.notificationTable)
      )[0]?.n,
      activities: (
        await db.select({ n: count() }).from(schema.activityTable)
      )[0]?.n,
    });
    const before = await rows();
    const publish = vi.spyOn(events, "publishEvent");
    const response = await draft(a.user, ws, 7);
    expect(response.status).toBe(200);
    await settleEvents();
    expect(publish).not.toHaveBeenCalled();
    expect(await rows()).toEqual(before);
    const [still] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, shipped.id));
    expect(still?.title).toBe("Ship login");
  });
});
