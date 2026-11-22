import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

beforeEach(resetTestDatabase);

const send = (method: string, body?: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

async function setup() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const workspaceId = owner.workspace.id;
  const [workProject] = await db
    .insert(schema.workProjectTable)
    .values({ workspaceId, name: "Launch" })
    .returning();
  mockAuthenticatedSession(owner.user);
  const { app } = createApp();
  const call = (method: string, path: string, body?: unknown) =>
    app.request(`/api/project-label${path}`, send(method, body));
  const create = async (name = "Q1", color = "red") =>
    (await call("POST", "", { workspaceId, name, color })).json();
  const actAs = async (role: string) => {
    const user = (await createWorkspaceMember({ role })).user;
    await db
      .insert(schema.workspaceUserTable)
      .values({ workspaceId, userId: user.id, role, joinedAt: new Date() });
    mockAuthenticatedSession(user);
  };
  return { owner, workspaceId, workProject, app, call, create, actAs };
}

describe("project labels", () => {
  it("creates, lists, renames and deletes workspace-scoped labels", async () => {
    const { call, create, workspaceId } = await setup();
    const label = await create("Q1");
    expect(label).toMatchObject({ name: "Q1", color: "red", workspaceId });
    expect(
      await (await call("GET", `/workspace/${workspaceId}`)).json(),
    ).toHaveLength(1);
    const renamed = await call("PUT", `/${label.id}`, {
      name: "Q2",
      color: "blue",
    });
    expect(await renamed.json()).toMatchObject({ name: "Q2", color: "blue" });
    expect((await call("DELETE", `/${label.id}`)).status).toBe(200);
    expect(
      await (await call("GET", `/workspace/${workspaceId}`)).json(),
    ).toEqual([]);
  });

  it("rejects duplicate names on create and rename", async () => {
    const { call, create, workspaceId } = await setup();
    await create("A");
    const b = await create("B");
    expect(
      (await call("POST", "", { workspaceId, name: "A", color: "red" })).status,
    ).toBe(409);
    expect(
      (await call("PUT", `/${b.id}`, { name: "A", color: "red" })).status,
    ).toBe(409);
  });

  it("assigns and unassigns a label, listed as labelIds on the project", async () => {
    const { app, call, create, workProject } = await setup();
    const label = await create();
    const assign = await call("PUT", `/${label.id}/work-project`, {
      workProjectId: workProject.id,
    });
    expect(assign.status).toBe(200);
    const detail = async () =>
      (await app.request(`/api/work-project/${workProject.id}`)).json();
    expect((await detail()).labelIds).toEqual([label.id]);
    await call("DELETE", `/${label.id}/work-project/${workProject.id}`);
    expect((await detail()).labelIds).toEqual([]);
  });

  it("deleting a label detaches it from projects", async () => {
    const { app, call, create, workProject } = await setup();
    const label = await create();
    await call("PUT", `/${label.id}/work-project`, {
      workProjectId: workProject.id,
    });
    await call("DELETE", `/${label.id}`);
    const detail = await (
      await app.request(`/api/work-project/${workProject.id}`)
    ).json();
    expect(detail.labelIds).toEqual([]);
  });

  it("refuses a project from another workspace", async () => {
    const { call, create } = await setup();
    const other = await createWorkspaceMember({ role: "owner" });
    const [foreign] = await db
      .insert(schema.workProjectTable)
      .values({ workspaceId: other.workspace.id, name: "Foreign" })
      .returning();
    const label = await create();
    expect(
      (
        await call("PUT", `/${label.id}/work-project`, {
          workProjectId: foreign.id,
        })
      ).status,
    ).toBe(400);
  });

  it("viewer can read but gets 403 on every write", async () => {
    const { call, create, workProject, workspaceId, actAs } = await setup();
    const label = await create();
    await actAs("viewer");
    expect((await call("GET", `/workspace/${workspaceId}`)).status).toBe(200);
    const writes = [
      call("POST", "", { workspaceId, name: "X", color: "red" }),
      call("PUT", `/${label.id}`, { name: "X", color: "red" }),
      call("DELETE", `/${label.id}`),
      call("PUT", `/${label.id}/work-project`, {
        workProjectId: workProject.id,
      }),
      call("DELETE", `/${label.id}/work-project/${workProject.id}`),
    ];
    for (const response of await Promise.all(writes))
      expect(response.status).toBe(403);
  });

  it("a non-member cannot read or write", async () => {
    const { call, create, workspaceId } = await setup();
    const label = await create();
    mockAuthenticatedSession(
      (await createWorkspaceMember({ role: "owner" })).user,
    );
    // Workspaces and labels outside the caller's access are hidden (403/404).
    for (const response of [
      await call("GET", `/workspace/${workspaceId}`),
      await call("DELETE", `/${label.id}`),
    ])
      expect([403, 404]).toContain(response.status);
  });
});
