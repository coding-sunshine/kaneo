import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

async function join(workspaceId: string, role: string) {
  const m = await createWorkspaceMember({ role });
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: m.user.id,
    role,
    joinedAt: new Date(),
  });
  return m.user;
}

async function setup() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const { project } = await createProjectFixture({
    workspaceId: owner.workspace.id,
  });
  await db.insert(schema.columnTable).values({
    projectId: project.id,
    name: "Triage",
    slug: "triage",
    position: 9,
  });
  mockAuthenticatedSession(owner.user);
  const { app } = createApp();
  const create = async (body: object) => {
    const response = await app.request(
      "/api/task/" + project.id,
      json("POST", {
        title: "Issue",
        description: "",
        priority: "no-priority",
        status: "to-do",
        ...body,
      }),
    );
    expect(response.status).toBe(200);
    return (await response.json()) as { id: string };
  };
  const row = async (id: string) =>
    (
      await db
        .select()
        .from(schema.taskTable)
        .where(eq(schema.taskTable.id, id))
    )[0];
  return { owner, project, app, create, row };
}

describe("API integration: team SLA", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("rejects unauthenticated access", async () => {
    mockAnonymousSession();
    const { app } = createApp();
    const response = await app.request(
      "/api/team-automation/sla/x",
      json("PUT", { slaEnabled: true }),
    );
    expect(response.status).toBe(401);
  });

  it("denies viewers and non-members the settings write", async () => {
    const { owner, project } = await setup();
    const viewer = await join(owner.workspace.id, "viewer");
    const outsider = await createWorkspaceMember({ role: "owner" });
    // A viewer is refused; a non-member does not learn the team exists.
    for (const [user, status] of [
      [viewer, 403],
      [outsider.user, 404],
    ] as const) {
      mockAuthenticatedSession(user);
      const { app } = createApp();
      const response = await app.request(
        `/api/team-automation/sla/${project.id}`,
        json("PUT", { slaEnabled: true }),
      );
      expect(response.status).toBe(status);
    }
    const [p] = await db.select().from(schema.projectTable);
    expect(p.slaEnabled).toBe(false);
  });

  it("sets a deadline for urgent and high issues and removes it otherwise", async () => {
    const { app, project, create, row } = await setup();
    const save = await app.request(
      `/api/team-automation/sla/${project.id}`,
      json("PUT", { slaEnabled: true, slaUrgentHours: 12 }),
    );
    expect(save.status).toBe(200);
    expect((await save.json()).slaUrgentHours).toBe(12);

    const urgent = await create({ priority: "urgent" });
    await vi.waitFor(async () =>
      expect((await row(urgent.id)).slaDueAt).not.toBeNull(),
    );
    const due = (await row(urgent.id)).slaDueAt as Date;
    expect(Math.abs(due.getTime() - Date.now() - 12 * 3_600_000)).toBeLessThan(
      60_000,
    );

    const medium = await create({ priority: "medium" });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect((await row(medium.id)).slaDueAt).toBeNull();

    // Raising the priority applies the rule; lowering it removes the deadline.
    const high = await app.request(
      `/api/task/priority/${medium.id}`,
      json("PUT", { priority: "high" }),
    );
    expect(high.status).toBe(200);
    await vi.waitFor(async () =>
      expect((await row(medium.id)).slaDueAt).not.toBeNull(),
    );
    const high168 = (await row(medium.id)).slaDueAt as Date;
    expect(
      Math.abs(high168.getTime() - Date.now() - 168 * 3_600_000),
    ).toBeLessThan(60_000);
    await app.request(
      `/api/task/priority/${medium.id}`,
      json("PUT", { priority: "low" }),
    );
    await vi.waitFor(async () =>
      expect((await row(medium.id)).slaDueAt).toBeNull(),
    );
  });

  it("leaves issues alone while SLAs are off", async () => {
    const { create, row } = await setup();
    const task = await create({ priority: "urgent" });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect((await row(task.id)).slaDueAt).toBeNull();
  });
});

describe("API integration: triage responsibility", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("saves the list, reads it back, and denies viewers and non-members the write", async () => {
    const { owner, project, app } = await setup();
    const ann = await join(owner.workspace.id, "member");
    const put = await app.request(
      `/api/team-automation/triage/${project.id}`,
      json("PUT", { mode: "assign", userIds: [ann.id] }),
    );
    expect(put.status).toBe(200);
    const got = await (
      await app.request(`/api/team-automation/triage/${project.id}`)
    ).json();
    expect(got).toEqual({ mode: "assign", userIds: [ann.id] });

    const outsider = await createWorkspaceMember({ role: "member" });
    const bad = await app.request(
      `/api/team-automation/triage/${project.id}`,
      json("PUT", { mode: "assign", userIds: [outsider.user.id] }),
    );
    expect(bad.status).toBe(400);

    const viewer = await join(owner.workspace.id, "viewer");
    for (const [user, status] of [
      [viewer, 403],
      [outsider.user, 404],
    ] as const) {
      mockAuthenticatedSession(user);
      const { app: other } = createApp();
      const denied = await other.request(
        `/api/team-automation/triage/${project.id}`,
        json("PUT", { mode: "notify", userIds: [] }),
      );
      expect(denied.status).toBe(status);
    }
    mockAuthenticatedSession(outsider.user);
    const { app: outsiderApp } = createApp();
    expect(
      (await outsiderApp.request(`/api/team-automation/triage/${project.id}`))
        .status,
    ).toBe(404);
  });

  it("rotates new triage issues through the people responsible", async () => {
    const { owner, project, app, create, row } = await setup();
    const ann = await join(owner.workspace.id, "member");
    const bob = await join(owner.workspace.id, "member");
    await app.request(
      `/api/team-automation/triage/${project.id}`,
      json("PUT", { mode: "assign", userIds: [ann.id, bob.id] }),
    );
    const assigned: string[] = [];
    for (let i = 0; i < 4; i++) {
      const task = await create({ status: "triage" });
      await vi.waitFor(async () =>
        expect((await row(task.id)).userId).not.toBeNull(),
      );
      assigned.push((await row(task.id)).userId as string);
    }
    expect(new Set(assigned.slice(0, 2)).size).toBe(2);
    expect(assigned.slice(2)).toEqual(assigned.slice(0, 2));

    // Not triage, or already assigned: untouched.
    const todo = await create({ status: "to-do" });
    const taken = await create({ status: "triage", userId: owner.user.id });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect((await row(todo.id)).userId).toBeNull();
    expect((await row(taken.id)).userId).toBe(owner.user.id);
  });

  it("skips people who cannot take the issue", async () => {
    const { owner, project, app, create, row } = await setup();
    const ann = await join(owner.workspace.id, "member");
    const bob = await join(owner.workspace.id, "member");
    await app.request(
      `/api/team-automation/triage/${project.id}`,
      json("PUT", { mode: "assign", userIds: [ann.id, bob.id] }),
    );
    await db
      .delete(schema.workspaceUserTable)
      .where(eq(schema.workspaceUserTable.userId, ann.id));
    const task = await create({ status: "triage" });
    await vi.waitFor(async () =>
      expect((await row(task.id)).userId).toBe(bob.id),
    );
  });

  it("notifies everyone responsible in notify mode and assigns nobody", async () => {
    const { owner, project, app, create, row } = await setup();
    const ann = await join(owner.workspace.id, "member");
    await app.request(
      `/api/team-automation/triage/${project.id}`,
      json("PUT", { mode: "notify", userIds: [ann.id] }),
    );
    const task = await create({ status: "triage" });
    await vi.waitFor(async () => {
      const rows = await db
        .select()
        .from(schema.notificationTable)
        .where(eq(schema.notificationTable.userId, ann.id));
      expect(rows.map((n) => n.type)).toContain("team_issue_triage");
    });
    expect((await row(task.id)).userId).toBeNull();
  });
});
