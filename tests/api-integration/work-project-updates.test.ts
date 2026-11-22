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

describe("API integration: work project updates", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("posts updates, sets project health, feeds pulse, blocks viewers", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();
    const p = await (
      await app.request(
        "/api/work-project",
        json("POST", { workspaceId: owner.workspace.id, name: "P" }),
      )
    ).json();
    expect(p.health).toBeNull();

    const posted = await app.request(
      `/api/work-project/${p.id}/update`,
      json("POST", { health: "atRisk", body: "Slipping" }),
    );
    expect(posted.status).toBe(200);
    expect(await posted.json()).toMatchObject({
      health: "atRisk",
      body: "Slipping",
      userId: owner.user.id,
      workProjectName: "P",
    });
    await app.request(
      `/api/work-project/${p.id}/update`,
      json("POST", { health: "onTrack" }),
    );

    const detail = await (
      await app.request(`/api/work-project/${p.id}`)
    ).json();
    expect(detail.health).toBe("onTrack");
    const list = await (
      await app.request(`/api/work-project/${p.id}/update`)
    ).json();
    expect(list.map((u: { health: string }) => u.health)).toEqual([
      "onTrack",
      "atRisk",
    ]);
    const pulse = await (
      await app.request(
        `/api/work-project/workspace/${owner.workspace.id}/updates`,
      )
    ).json();
    expect(pulse).toHaveLength(2);

    const bad = await app.request(
      `/api/work-project/${p.id}/update`,
      json("POST", { health: "nope" }),
    );
    expect(bad.status).toBe(400);

    const viewer = await createWorkspaceMember({ role: "viewer" });
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: owner.workspace.id,
      userId: viewer.user.id,
      role: "viewer",
      joinedAt: new Date(),
    });
    mockAuthenticatedSession(viewer.user);
    const { app: viewerApp } = createApp();
    expect(
      (await viewerApp.request(`/api/work-project/${p.id}/update`)).status,
    ).toBe(200);
    expect(
      (
        await viewerApp.request(
          `/api/work-project/${p.id}/update`,
          json("POST", { health: "offTrack" }),
        )
      ).status,
    ).toBe(403);
  });

  it("lets authors edit and delete, admins delete, and keeps health on the latest", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const join = async (role: string) => {
      const m = await createWorkspaceMember({ role });
      await db.insert(schema.workspaceUserTable).values({
        workspaceId: owner.workspace.id,
        userId: m.user.id,
        role,
        joinedAt: new Date(),
      });
      return m.user;
    };
    const author = await join("member");
    const other = await join("member");
    mockAuthenticatedSession(owner.user);
    const p = await (
      await createApp().app.request(
        "/api/work-project",
        json("POST", { workspaceId: owner.workspace.id, name: "P" }),
      )
    ).json();
    const as = (user: typeof author) => {
      mockAuthenticatedSession(user);
      return createApp().app;
    };
    const post = async (user: typeof author, health: string) =>
      (
        await as(user).request(
          `/api/work-project/${p.id}/update`,
          json("POST", { health, body: health }),
        )
      ).json();
    const health = async () =>
      (await (await as(owner.user).request(`/api/work-project/${p.id}`)).json())
        .health;

    const first = await post(author, "onTrack");
    const second = await post(author, "offTrack");
    const third = await post(other, "atRisk");
    expect(await health()).toBe("atRisk");

    // non-author member: 403 on edit and delete
    expect(
      (
        await as(other).request(
          `/api/work-project/update/${first.id}`,
          json("PUT", { body: "x" }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await as(other).request(
          `/api/work-project/update/${first.id}`,
          json("DELETE"),
        )
      ).status,
    ).toBe(403);
    // admin may not edit someone else's update
    expect(
      (
        await as(owner.user).request(
          `/api/work-project/update/${first.id}`,
          json("PUT", { body: "x" }),
        )
      ).status,
    ).toBe(403);

    // editing a non-latest update leaves health alone; editing the latest moves it
    const edited = await as(author).request(
      `/api/work-project/update/${second.id}`,
      json("PUT", { health: "onTrack", body: "fine now" }),
    );
    expect(edited.status).toBe(200);
    expect(await health()).toBe("atRisk");
    await as(other).request(
      `/api/work-project/update/${third.id}`,
      json("PUT", { health: "offTrack" }),
    );
    expect(await health()).toBe("offTrack");

    // deleting the latest falls back to the previous one, then to none
    expect(
      (
        await as(other).request(
          `/api/work-project/update/${third.id}`,
          json("DELETE"),
        )
      ).status,
    ).toBe(200);
    expect(await health()).toBe("onTrack");
    expect(
      (
        await as(owner.user).request(
          `/api/work-project/update/${second.id}`,
          json("DELETE"),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await as(author).request(
          `/api/work-project/update/${first.id}`,
          json("DELETE"),
        )
      ).status,
    ).toBe(200);
    expect(await health()).toBeNull();
    expect(
      (
        await as(author).request(
          `/api/work-project/update/${first.id}`,
          json("DELETE"),
        )
      ).status,
    ).toBe(404);
  });
});
