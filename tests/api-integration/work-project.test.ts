import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
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

async function setup() {
  const member = await createWorkspaceMember({ role: "owner" });
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  mockAuthenticatedSession(member.user);
  const { app } = createApp();
  const task = async (
    number: number,
    columnId = columns.todo.id,
    status = "to-do",
  ) =>
    (
      await db
        .insert(schema.taskTable)
        .values({
          projectId: project.id,
          title: `Task ${number}`,
          status,
          columnId,
          priority: "medium",
          number,
          position: number,
        })
        .returning()
    )[0];
  return { app, member, project, columns, task };
}

describe("API integration: work projects", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("rejects unauthenticated access", async () => {
    mockAnonymousSession();
    const { app } = createApp();
    const response = await app.request("/api/work-project/workspace/x");
    expect(response.status).toBe(401);
  });

  it("creates, lists by team, updates and deletes a project", async () => {
    const { app, member, project } = await setup();
    const { project: otherTeam } = await createProjectFixture({
      workspaceId: member.workspace.id,
      name: "Other team",
    });

    const created = await app.request(
      "/api/work-project",
      json("POST", {
        workspaceId: member.workspace.id,
        name: "Roadmap",
        status: "started",
        leadId: member.user.id,
        teamIds: [project.id],
        memberIds: [member.user.id],
        targetDate: "2026-12-31",
      }),
    );
    expect(created.status).toBe(200);
    const body = await created.json();
    expect(body).toMatchObject({
      name: "Roadmap",
      status: "started",
      leadId: member.user.id,
      teamIds: [project.id],
      memberIds: [member.user.id],
      milestones: [],
      progress: { total: 0, done: 0 },
    });

    const all = await app.request(
      `/api/work-project/workspace/${member.workspace.id}`,
    );
    expect(await all.json()).toHaveLength(1);
    const team = await app.request(
      `/api/work-project/workspace/${member.workspace.id}?teamId=${project.id}`,
    );
    expect(await team.json()).toHaveLength(1);
    const other = await app.request(
      `/api/work-project/workspace/${member.workspace.id}?teamId=${otherTeam.id}`,
    );
    expect(await other.json()).toHaveLength(0);

    const updated = await app.request(
      `/api/work-project/${body.id}`,
      json("PUT", {
        status: "completed",
        teamIds: [otherTeam.id],
        targetDate: null,
      }),
    );
    expect(await updated.json()).toMatchObject({
      status: "completed",
      teamIds: [otherTeam.id],
      memberIds: [member.user.id],
      targetDate: null,
      name: "Roadmap",
    });

    const deleted = await app.request(
      `/api/work-project/${body.id}`,
      json("DELETE"),
    );
    expect(deleted.status).toBe(200);
    expect(await db.select().from(schema.workProjectTable)).toHaveLength(0);
  });

  // The web sends the teams alone, or the members alone, when a person
  // changes them.
  it("saves a change to the teams or the members alone", async () => {
    const { app, member, project } = await setup();
    const { project: otherTeam } = await createProjectFixture({
      workspaceId: member.workspace.id,
      name: "Other team",
    });
    const created = await (
      await app.request(
        "/api/work-project",
        json("POST", {
          workspaceId: member.workspace.id,
          name: "Roadmap",
          teamIds: [project.id],
        }),
      )
    ).json();

    const teams = await app.request(
      `/api/work-project/${created.id}`,
      json("PUT", { teamIds: [otherTeam.id] }),
    );
    expect(teams.status).toBe(200);
    expect((await teams.json()).teamIds).toEqual([otherTeam.id]);

    const members = await app.request(
      `/api/work-project/${created.id}`,
      json("PUT", { memberIds: [member.user.id] }),
    );
    expect(members.status).toBe(200);
    expect((await members.json()).memberIds).toEqual([member.user.id]);
  });

  it("validates names, statuses, duplicates and foreign users or teams", async () => {
    const { app, member } = await setup();
    const other = await createWorkspaceMember({ userName: "Stranger" });
    const { project: foreignTeam } = await createProjectFixture({
      workspaceId: other.workspace.id,
    });
    const create = (extra: object) =>
      app.request(
        "/api/work-project",
        json("POST", { workspaceId: member.workspace.id, name: "P", ...extra }),
      );

    expect((await create({ name: "  " })).status).toBe(400);
    expect((await create({ status: "done" })).status).toBe(400);
    expect((await create({ leadId: other.user.id })).status).toBe(400);
    expect((await create({ teamIds: [foreignTeam.id] })).status).toBe(400);
    expect((await create({ targetDate: "not a date" })).status).toBe(400);
    expect((await create({})).status).toBe(200);
    expect((await create({})).status).toBe(409);
    const second = await (await create({ name: "Q" })).json();
    const rename = await app.request(
      `/api/work-project/${second.id}`,
      json("PUT", { name: "P" }),
    );
    expect(rename.status).toBe(409);
    const keep = await app.request(
      `/api/work-project/${second.id}`,
      json("PUT", { name: "Q" }),
    );
    expect(keep.status).toBe(200);
  });

  it("keeps a workspace's projects hidden from other workspaces", async () => {
    const { app, member } = await setup();
    const created = await (
      await app.request(
        "/api/work-project",
        json("POST", { workspaceId: member.workspace.id, name: "Private" }),
      )
    ).json();

    const stranger = await createWorkspaceMember({ userName: "Stranger" });
    mockAuthenticatedSession(stranger.user);
    const { app: strangerApp } = createApp();
    expect(
      (await strangerApp.request(`/api/work-project/${created.id}`)).status,
    ).toBe(404);
    expect(
      (
        await strangerApp.request(
          `/api/work-project/${created.id}`,
          json("DELETE"),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await strangerApp.request(
          `/api/work-project/workspace/${member.workspace.id}`,
        )
      ).status,
    ).toBe(404);
  });

  it("orders milestones and reports progress for projects and milestones", async () => {
    const { app, member, project, columns, task } = await setup();
    const created = await (
      await app.request(
        "/api/work-project",
        json("POST", {
          workspaceId: member.workspace.id,
          name: "Roadmap",
          teamIds: [project.id],
        }),
      )
    ).json();
    const milestone = async (name: string) =>
      await (
        await app.request(
          `/api/work-project/${created.id}/milestone`,
          json("POST", { name }),
        )
      ).json();
    const m1 = await milestone("Alpha");
    const m2 = await milestone("Beta");
    expect([m1.sortOrder, m2.sortOrder]).toEqual([0, 1]);
    expect(
      (
        await app.request(
          `/api/work-project/${created.id}/milestone`,
          json("POST", { name: "Alpha" }),
        )
      ).status,
    ).toBe(409);
    const rename = (name: string) =>
      app.request(
        `/api/work-project/milestone/${m2.id}`,
        json("PUT", { name }),
      );
    expect((await rename("Alpha")).status).toBe(409);
    expect((await rename("Beta")).status).toBe(200);

    const set = (
      id: string,
      workProjectId: string | null,
      workProjectMilestoneId?: string | null,
    ) =>
      app.request(
        `/api/task/work-project/${id}`,
        json("PUT", { workProjectId, workProjectMilestoneId }),
      );
    const open = await task(1);
    const done = await task(2, columns.done.id, "done");
    const canceled = await task(3, columns.done.id, "canceled");
    for (const t of [open, done, canceled])
      expect((await set(t.id, created.id, m1.id)).status).toBe(200);

    const detail = await (
      await app.request(`/api/work-project/${created.id}`)
    ).json();
    expect(detail.progress).toEqual({ total: 2, done: 1 });
    expect(detail.milestones.map((m: { name: string }) => m.name)).toEqual([
      "Alpha",
      "Beta",
    ]);
    expect(detail.milestones[0].progress).toEqual({ total: 2, done: 1 });
    expect(detail.milestones[1].progress).toEqual({ total: 0, done: 0 });

    await app.request(
      `/api/work-project/milestone/${m2.id}`,
      json("PUT", { sortOrder: -1 }),
    );
    const reordered = await (
      await app.request(`/api/work-project/${created.id}`)
    ).json();
    expect(reordered.milestones.map((m: { name: string }) => m.name)).toEqual([
      "Beta",
      "Alpha",
    ]);

    await app.request(`/api/work-project/milestone/${m1.id}`, json("DELETE"));
    const after = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, open.id),
    });
    expect(after).toMatchObject({
      workProjectId: created.id,
      workProjectMilestoneId: null,
    });
  });

  it("sets, moves and clears a task's project and milestone", async () => {
    const { app, member, project, task } = await setup();
    const make = async (name: string) =>
      await (
        await app.request(
          "/api/work-project",
          json("POST", { workspaceId: member.workspace.id, name }),
        )
      ).json();
    const a = await make("A");
    const b = await make("B");
    const ma = await (
      await app.request(
        `/api/work-project/${a.id}/milestone`,
        json("POST", { name: "M" }),
      )
    ).json();
    const t = await task(1);
    const set = (body: object) =>
      app.request(`/api/task/work-project/${t.id}`, json("PUT", body));

    expect(
      await (
        await set({ workProjectId: a.id, workProjectMilestoneId: ma.id })
      ).json(),
    ).toMatchObject({
      workProjectId: a.id,
      workProjectMilestoneId: ma.id,
    });
    // a milestone must belong to the chosen project, and needs one
    expect(
      (await set({ workProjectId: b.id, workProjectMilestoneId: ma.id }))
        .status,
    ).toBe(404);
    expect(
      (await set({ workProjectId: null, workProjectMilestoneId: ma.id }))
        .status,
    ).toBe(400);
    // switching project drops the old milestone
    expect(await (await set({ workProjectId: b.id })).json()).toMatchObject({
      workProjectId: b.id,
      workProjectMilestoneId: null,
    });
    expect(await (await set({ workProjectId: null })).json()).toMatchObject({
      workProjectId: null,
    });

    // task lists and the task itself carry the project
    await set({ workProjectId: a.id });
    const list = await (
      await app.request(`/api/task/tasks/${project.id}`)
    ).json();
    expect(
      list.data.columns.flatMap((c: { tasks: unknown[] }) => c.tasks)[0],
    ).toMatchObject({ workProjectId: a.id });
    expect(await (await app.request(`/api/task/${t.id}`)).json()).toMatchObject(
      { workProjectId: a.id },
    );

    // deleting the project keeps the issue and clears its link
    await app.request(`/api/work-project/${a.id}`, json("DELETE"));
    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, t.id),
      }),
    ).toMatchObject({ workProjectId: null, workProjectMilestoneId: null });
  });

  it("creates a task directly inside a project and milestone", async () => {
    const { app, member, project } = await setup();
    const p = await (
      await app.request(
        "/api/work-project",
        json("POST", { workspaceId: member.workspace.id, name: "P" }),
      )
    ).json();
    const m = await (
      await app.request(
        `/api/work-project/${p.id}/milestone`,
        json("POST", { name: "M" }),
      )
    ).json();
    const create = (extra: object) =>
      app.request(
        `/api/task/${project.id}`,
        json("POST", {
          title: "T",
          description: "",
          priority: "low",
          status: "to-do",
          ...extra,
        }),
      );

    expect(
      await (
        await create({ workProjectId: p.id, workProjectMilestoneId: m.id })
      ).json(),
    ).toMatchObject({
      workProjectId: p.id,
      workProjectMilestoneId: m.id,
    });
    expect((await create({ workProjectId: "nope" })).status).toBe(404);
  });

  it("does not let a viewer change projects", async () => {
    const { app, member } = await setup();
    const p = await (
      await app.request(
        "/api/work-project",
        json("POST", { workspaceId: member.workspace.id, name: "P" }),
      )
    ).json();
    const viewer = await createWorkspaceMember({ role: "viewer" });
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: member.workspace.id,
      userId: viewer.user.id,
      role: "viewer",
      joinedAt: new Date(),
    });
    mockAuthenticatedSession(viewer.user);
    const { app: viewerApp } = createApp();
    expect((await viewerApp.request(`/api/work-project/${p.id}`)).status).toBe(
      200,
    );
    expect(
      (
        await viewerApp.request(
          `/api/work-project/${p.id}`,
          json("PUT", { name: "X" }),
        )
      ).status,
    ).toBe(403);
    expect(
      (await viewerApp.request(`/api/work-project/${p.id}`, json("DELETE")))
        .status,
    ).toBe(403);
  });
});
