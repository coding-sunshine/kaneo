import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(resetTestDatabase);

const json = (body: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

async function setup() {
  const member = await createWorkspaceMember({ role: "admin" });
  const workspaceId = member.workspace.id;
  const { project: teamA } = await createProjectFixture({ workspaceId });
  const { project: teamB } = await createProjectFixture({ workspaceId });
  const [task] = await db
    .insert(schema.taskTable)
    .values({ projectId: teamA.id, title: "T", status: "to-do", number: 1 })
    .returning();
  mockAuthenticatedSession(member.user);
  const { app } = createApp();
  const create = async (body: Record<string, unknown>) =>
    app.request("/api/label", json({ color: "red", workspaceId, ...body }));
  const attach = (id: string, taskId = task.id) =>
    app.request(`/api/label/${id}/task`, {
      ...json({ taskId }),
      method: "PUT",
    });
  const onTask = async () =>
    (
      await db
        .select()
        .from(schema.labelTable)
        .where(eq(schema.labelTable.taskId, task.id))
    ).map((l) => l.name);
  return {
    member,
    app,
    workspaceId,
    teamA,
    teamB,
    task,
    create,
    attach,
    onTask,
  };
}

describe("team labels", () => {
  it("creates a team label and keeps workspace labels unscoped", async () => {
    const { create, teamA } = await setup();
    const ws = await (await create({ name: "ws" })).json();
    const team = await (
      await create({ name: "team", projectId: teamA.id })
    ).json();
    expect(ws.projectId).toBeNull();
    expect(team.projectId).toBe(teamA.id);
  });

  it("rejects a project from another workspace", async () => {
    const { create } = await setup();
    const other = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: other.workspace.id,
    });
    expect((await create({ name: "x", projectId: project.id })).status).toBe(
      404,
    );
  });

  it("attaches a team label only to that team's issues", async () => {
    const { create, attach, teamB, onTask } = await setup();
    const label = await (
      await create({ name: "b-only", projectId: teamB.id })
    ).json();
    expect((await attach(label.id)).status).toBe(400);
    expect(await onTask()).toEqual([]);
  });

  it("blocks a viewer from creating labels", async () => {
    const { workspaceId } = await setup();
    const viewer = await createWorkspaceMember({ role: "viewer" });
    mockAuthenticatedSession(viewer.user);
    const res = await createApp().app.request(
      "/api/label",
      json({ name: "v", color: "red", workspaceId: viewer.workspace.id }),
    );
    expect(res.status).toBe(403);
    expect(workspaceId).not.toBe(viewer.workspace.id);
  });
});

describe("label groups", () => {
  it("replaces the sibling when a second label of a group is picked", async () => {
    const { create, attach, onTask } = await setup();
    const group = await (await create({ name: "Priority" })).json();
    const a = await (
      await create({ name: "p1", parentLabelId: group.id })
    ).json();
    const b = await (
      await create({ name: "p2", parentLabelId: group.id })
    ).json();
    const free = await (await create({ name: "free" })).json();
    expect((await attach(a.id)).status).toBe(200);
    expect((await attach(free.id)).status).toBe(200);
    expect((await attach(b.id)).status).toBe(200);
    expect((await onTask()).sort()).toEqual(["free", "p2"]);
  });

  it("does not let a group itself be assigned, nested or self-parented", async () => {
    const { app, create, attach } = await setup();
    const group = await (await create({ name: "G" })).json();
    const child = await (
      await create({ name: "c", parentLabelId: group.id })
    ).json();
    expect((await attach(group.id)).status).toBe(400);
    expect((await create({ name: "n", parentLabelId: child.id })).status).toBe(
      400,
    );
    const res = await app.request(`/api/label/${group.id}`, {
      ...json({ name: "G", color: "red", parentLabelId: group.id }),
      method: "PUT",
    });
    expect(res.status).toBe(400);
  });

  it("ungroups children when the group is deleted", async () => {
    const { app, create } = await setup();
    const group = await (await create({ name: "G" })).json();
    const child = await (
      await create({ name: "c", parentLabelId: group.id })
    ).json();
    expect(
      (await app.request(`/api/label/${group.id}`, { method: "DELETE" }))
        .status,
    ).toBe(200);
    const [row] = await db
      .select()
      .from(schema.labelTable)
      .where(and(eq(schema.labelTable.id, child.id)));
    expect(row.parentLabelId).toBeNull();
  });
});
