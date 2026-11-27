import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

type User = Awaited<ReturnType<typeof createWorkspaceMember>>["user"];

const as = (user: User) => {
  mockAuthenticatedSession(user);
  return createApp().app;
};

async function join(workspaceId: string, role: string, guest = false) {
  const m = await createWorkspaceMember({ role });
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: m.user.id,
    role,
    joinedAt: new Date(),
  });
  if (guest)
    await db.insert(schema.workspaceMemberAccessTable).values({
      workspaceId,
      userId: m.user.id,
      projectAccess: "selected",
      guest: true,
    });
  return m.user;
}

async function workProject(user: User, workspaceId: string, name: string) {
  const res = await as(user).request(
    "/api/work-project",
    json("POST", { workspaceId, name }),
  );
  expect(res.status).toBe(200);
  return (await res.json()) as { id: string };
}

const addDependency = (user: User, id: string, dependsOnId: string) =>
  as(user).request(
    `/api/work-project/${id}/dependency`,
    json("POST", { dependsOnId }),
  );

describe("API integration: work project dependencies", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("links two projects both ways and unlinks them", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const ws = owner.workspace.id;
    const x = await workProject(owner.user, ws, "X");
    const y = await workProject(owner.user, ws, "Y");

    const added = await addDependency(owner.user, x.id, y.id);
    expect(added.status).toBe(200);
    expect((await added.json()).dependsOnIds).toEqual([y.id]);

    const app = as(owner.user);
    const yDetail = await (
      await app.request(`/api/work-project/${y.id}`)
    ).json();
    expect(yDetail.dependentIds).toEqual([x.id]);
    expect(yDetail.dependsOnIds).toEqual([]);
    const list = await (
      await app.request(`/api/work-project/workspace/${ws}`)
    ).json();
    expect(
      list.find((p: { id: string }) => p.id === x.id).dependsOnIds,
    ).toEqual([y.id]);

    // Adding the same link again keeps one.
    expect((await addDependency(owner.user, x.id, y.id)).status).toBe(200);

    const removed = await app.request(
      `/api/work-project/${x.id}/dependency/${y.id}`,
      json("DELETE"),
    );
    expect(removed.status).toBe(200);
    expect((await removed.json()).dependsOnIds).toEqual([]);
    const yAfter = await (
      await app.request(`/api/work-project/${y.id}`)
    ).json();
    expect(yAfter.dependentIds).toEqual([]);
  });

  it("refuses self links, cycles and projects from another workspace", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const ws = owner.workspace.id;
    const x = await workProject(owner.user, ws, "X");
    const y = await workProject(owner.user, ws, "Y");
    const z = await workProject(owner.user, ws, "Z");

    expect((await addDependency(owner.user, x.id, x.id)).status).toBe(400);

    expect((await addDependency(owner.user, x.id, y.id)).status).toBe(200);
    expect((await addDependency(owner.user, y.id, z.id)).status).toBe(200);
    expect((await addDependency(owner.user, z.id, x.id)).status).toBe(409);

    const stranger = await createWorkspaceMember({ role: "owner" });
    const foreign = await workProject(
      stranger.user,
      stranger.workspace.id,
      "Theirs",
    );
    expect((await addDependency(owner.user, x.id, foreign.id)).status).toBe(
      400,
    );
    // Nor can the stranger link their project to ours.
    expect((await addDependency(stranger.user, foreign.id, x.id)).status).toBe(
      400,
    );
    expect(
      [403, 404].includes(
        (await addDependency(stranger.user, x.id, y.id)).status,
      ),
    ).toBe(true);
  });

  it("lets only people who can update projects change links", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const ws = owner.workspace.id;
    const x = await workProject(owner.user, ws, "X");
    const y = await workProject(owner.user, ws, "Y");
    expect((await addDependency(owner.user, x.id, y.id)).status).toBe(200);

    const viewer = await join(ws, "viewer");
    expect((await addDependency(viewer, y.id, x.id)).status).toBe(403);
    expect(
      (
        await as(viewer).request(
          `/api/work-project/${x.id}/dependency/${y.id}`,
          json("DELETE"),
        )
      ).status,
    ).toBe(403);

    const guest = await join(ws, "member", true);
    expect((await addDependency(guest, y.id, x.id)).status).toBe(404);
    expect(
      (
        await as(guest).request(
          `/api/work-project/${x.id}/dependency/${y.id}`,
          json("DELETE"),
        )
      ).status,
    ).toBe(404);
  });
});
