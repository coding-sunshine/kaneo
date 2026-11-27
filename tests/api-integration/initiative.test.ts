import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
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

describe("API integration: initiatives", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("groups projects, rolls up health and progress, and feeds pulse", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const ws = owner.workspace.id;
    const a = await workProject(owner.user, ws, "A");
    const b = await workProject(owner.user, ws, "B");
    const { project: team, columns } = await createProjectFixture({
      workspaceId: ws,
    });
    const tasks: [string, string][] = [
      [a.id, "done"],
      [a.id, "to-do"],
      [b.id, "done"],
    ];
    for (const [index, [workProjectId, status]] of tasks.entries())
      await db.insert(schema.taskTable).values({
        projectId: team.id,
        workProjectId,
        title: `Task ${index}`,
        status,
        columnId: status === "done" ? columns.done.id : columns.todo.id,
        priority: "medium",
        number: index + 1,
        position: index,
      });
    const app = as(owner.user);

    const created = await app.request(
      "/api/initiative",
      json("POST", {
        workspaceId: ws,
        name: "Grow",
        ownerId: owner.user.id,
        targetDate: "2027-01-31T00:00:00.000Z",
        workProjectIds: [a.id, b.id],
      }),
    );
    expect(created.status).toBe(200);
    const initiative = await created.json();
    expect(initiative).toMatchObject({
      name: "Grow",
      ownerId: owner.user.id,
      health: null,
      rolledUpHealth: null,
      progress: { total: 3, done: 2 },
    });
    expect([...initiative.workProjectIds].sort()).toEqual([a.id, b.id].sort());

    await app.request(
      `/api/work-project/${a.id}/update`,
      json("POST", { health: "atRisk" }),
    );
    const posted = await app.request(
      `/api/initiative/${initiative.id}/update`,
      json("POST", { health: "onTrack", body: "Going well" }),
    );
    expect(posted.status).toBe(200);
    expect(await posted.json()).toMatchObject({
      initiativeId: initiative.id,
      initiativeName: "Grow",
      health: "onTrack",
      body: "Going well",
    });

    const detail = await (
      await app.request(`/api/initiative/${initiative.id}`)
    ).json();
    expect(detail.health).toBe("onTrack");
    // The worst of the initiative's own update and its projects' health.
    expect(detail.rolledUpHealth).toBe("atRisk");
    expect(
      detail.workProjects.map((p: { name: string }) => p.name).sort(),
    ).toEqual(["A", "B"]);

    const list = await (
      await app.request(`/api/initiative/workspace/${ws}`)
    ).json();
    expect(list).toHaveLength(1);
    expect(list[0].rolledUpHealth).toBe("atRisk");

    const pulse = await (
      await app.request(`/api/initiative/workspace/${ws}/updates`)
    ).json();
    expect(pulse.map((u: { body: string }) => u.body)).toEqual(["Going well"]);

    // Detaching a project drops it from the roll-up.
    const detached = await app.request(
      `/api/initiative/${initiative.id}`,
      json("PUT", { workProjectIds: [b.id] }),
    );
    expect(detached.status).toBe(200);
    const afterDetach = await detached.json();
    expect(afterDetach.rolledUpHealth).toBe("onTrack");
    expect(afterDetach.progress).toEqual({ total: 1, done: 1 });

    const removed = await app.request(
      `/api/initiative/${initiative.id}`,
      json("DELETE"),
    );
    expect(removed.status).toBe(200);
    expect((await app.request(`/api/initiative/${initiative.id}`)).status).toBe(
      404,
    );
  });

  it("refuses projects and owners from outside the workspace", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const stranger = await createWorkspaceMember({ role: "owner" });
    const foreign = await workProject(
      stranger.user,
      stranger.workspace.id,
      "Theirs",
    );
    const app = as(owner.user);
    const withProject = await app.request(
      "/api/initiative",
      json("POST", {
        workspaceId: owner.workspace.id,
        name: "X",
        workProjectIds: [foreign.id],
      }),
    );
    expect(withProject.status).toBe(400);
    const withOwner = await app.request(
      "/api/initiative",
      json("POST", {
        workspaceId: owner.workspace.id,
        name: "X",
        ownerId: stranger.user.id,
      }),
    );
    expect(withOwner.status).toBe(400);
  });

  it("keeps initiatives inside their workspace and its roles", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const ws = owner.workspace.id;
    const initiative = await (
      await as(owner.user).request(
        "/api/initiative",
        json("POST", { workspaceId: ws, name: "Grow" }),
      )
    ).json();
    const update = await (
      await as(owner.user).request(
        `/api/initiative/${initiative.id}/update`,
        json("POST", { health: "onTrack" }),
      )
    ).json();
    // Every write, and every read of one initiative, by id.
    const byId: [string, string, unknown?][] = [
      [`/api/initiative/${initiative.id}`, "GET"],
      [`/api/initiative/${initiative.id}`, "PUT", { name: "Mine" }],
      [`/api/initiative/${initiative.id}`, "DELETE"],
      [`/api/initiative/${initiative.id}/update`, "GET"],
      [`/api/initiative/${initiative.id}/update`, "POST", { health: "atRisk" }],
      [`/api/initiative/update/${update.id}`, "DELETE"],
    ];

    // Someone from another workspace sees nothing of it.
    const outsider = await createWorkspaceMember({ role: "owner" });
    const outsiderApp = as(outsider.user);
    for (const [path, method, body] of byId)
      expect([403, 404]).toContain(
        (await outsiderApp.request(path, json(method, body))).status,
      );
    expect([403, 404]).toContain(
      (
        await outsiderApp.request(
          "/api/initiative",
          json("POST", { workspaceId: ws, name: "Mine" }),
        )
      ).status,
    );
    expect(
      (await outsiderApp.request(`/api/initiative/${initiative.id}`)).status,
    ).not.toBe(200);
    expect(
      (await outsiderApp.request(`/api/initiative/workspace/${ws}`)).status,
    ).not.toBe(200);
    expect(
      (
        await outsiderApp.request(
          `/api/initiative/${initiative.id}`,
          json("PUT", { name: "Mine" }),
        )
      ).status,
    ).not.toBe(200);

    // A viewer reads but cannot create, edit or post.
    const viewer = await join(ws, "viewer");
    const viewerApp = as(viewer);
    expect(
      (await viewerApp.request(`/api/initiative/${initiative.id}`)).status,
    ).toBe(200);
    expect(
      (
        await viewerApp.request(
          "/api/initiative",
          json("POST", { workspaceId: ws, name: "V" }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await viewerApp.request(
          `/api/initiative/${initiative.id}`,
          json("PUT", { name: "V" }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await viewerApp.request(
          `/api/initiative/${initiative.id}/update`,
          json("POST", { health: "offTrack" }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await viewerApp.request(
          `/api/initiative/${initiative.id}`,
          json("DELETE"),
        )
      ).status,
    ).toBe(403);

    // A guest has no workspace-wide initiatives.
    const guest = await join(ws, "member", true);
    const guestApp = as(guest);
    expect(
      await (await guestApp.request(`/api/initiative/workspace/${ws}`)).json(),
    ).toEqual([]);
    expect(
      await (
        await guestApp.request(`/api/initiative/workspace/${ws}/updates`)
      ).json(),
    ).toEqual([]);
    for (const [path, method, body] of byId)
      expect((await guestApp.request(path, json(method, body))).status).toBe(
        404,
      );
    expect(
      (
        await guestApp.request(
          "/api/initiative",
          json("POST", { workspaceId: ws, name: "G" }),
        )
      ).status,
    ).toBe(404);
    // Nothing a guest or outsider sent got through.
    const detail = await (
      await as(owner.user).request(`/api/initiative/${initiative.id}`)
    ).json();
    expect(detail.name).toBe("Grow");
    expect(detail.health).toBe("onTrack");
  });

  it("lets only the author or an admin delete an update", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const ws = owner.workspace.id;
    const author = await join(ws, "member");
    const other = await join(ws, "member");
    const initiative = await (
      await as(owner.user).request(
        "/api/initiative",
        json("POST", { workspaceId: ws, name: "Grow" }),
      )
    ).json();
    const post = async () =>
      (
        await as(author).request(
          `/api/initiative/${initiative.id}/update`,
          json("POST", { health: "atRisk" }),
        )
      ).json();
    const first = await post();
    const second = await post();

    expect(
      (
        await as(other).request(
          `/api/initiative/update/${first.id}`,
          json("DELETE"),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await as(author).request(
          `/api/initiative/update/${first.id}`,
          json("DELETE"),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await as(owner.user).request(
          `/api/initiative/update/${second.id}`,
          json("DELETE"),
        )
      ).status,
    ).toBe(200);
    const detail = await (
      await as(owner.user).request(`/api/initiative/${initiative.id}`)
    ).json();
    expect(detail.health).toBeNull();
  });
});
