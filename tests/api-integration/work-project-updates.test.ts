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
});
