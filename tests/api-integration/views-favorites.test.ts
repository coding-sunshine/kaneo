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

describe("API integration: views and favorites", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("saves, lists, renames and deletes a team view; only the owner edits", async () => {
    const member = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const ws = member.workspace.id;

    const created = await app.request(
      "/api/view",
      json("POST", {
        workspaceId: ws,
        projectId: project.id,
        name: "Urgent",
        filters: { priority: ["urgent"] },
        display: { layout: "list" },
      }),
    );
    expect(created.status).toBe(200);
    const view = await created.json();
    expect(view).toMatchObject({ name: "Urgent", projectId: project.id });

    const workspaceView = await app.request(
      "/api/view",
      json("POST", {
        workspaceId: ws,
        projectId: null,
        name: "Everything",
        filters: {},
        display: {},
      }),
    );
    expect(workspaceView.status).toBe(200);
    expect(
      await (await app.request(`/api/view/workspace/${ws}`)).json(),
    ).toHaveLength(2);

    const renamed = await app.request(
      `/api/view/workspace/${ws}/${view.id}`,
      json("PUT", { name: "Urgent now" }),
    );
    expect((await renamed.json()).name).toBe("Urgent now");

    const other = await createWorkspaceMember({ role: "owner" });
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: other.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    mockAuthenticatedSession(other.user);
    const foreign = await app.request(
      `/api/view/workspace/${ws}/${view.id}`,
      json("PUT", { name: "Hijack" }),
    );
    expect(foreign.status).toBe(403);

    mockAuthenticatedSession(member.user);
    const removed = await app.request(`/api/view/workspace/${ws}/${view.id}`, {
      method: "DELETE",
    });
    expect(removed.status).toBe(200);
    expect(
      (await app.request(`/api/view/workspace/${ws}/${view.id}`)).status,
    ).toBe(404);
  });

  it("keeps favorites per user and ignores repeats", async () => {
    const member = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const url = `/api/favorite/workspace/${member.workspace.id}`;
    const fav = { type: "project", targetId: project.id };

    for (let i = 0; i < 2; i++)
      expect((await app.request(url, json("PUT", fav))).status).toBe(200);
    expect(await (await app.request(url)).json()).toHaveLength(1);

    const removed = await app.request(
      `${url}?type=project&targetId=${project.id}`,
      { method: "DELETE" },
    );
    expect(removed.status).toBe(200);
    expect(await (await app.request(url)).json()).toHaveLength(0);
  });
});
