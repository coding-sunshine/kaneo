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
  it("favorites a pull request by owner/repo#number", async () => {
    const member = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const url = `/api/favorite/workspace/${member.workspace.id}`;
    const fav = { type: "pullRequest", targetId: "acme/web#7" };

    expect((await app.request(url, json("PUT", fav))).status).toBe(200);
    expect(await (await app.request(url)).json()).toMatchObject([fav]);

    const removed = await app.request(
      `${url}?type=pullRequest&targetId=${encodeURIComponent(fav.targetId)}`,
      { method: "DELETE" },
    );
    expect(removed.status).toBe(200);
    expect(await (await app.request(url)).json()).toHaveLength(0);
  });

  describe("view visibility", () => {
    async function setup() {
      const owner = await createWorkspaceMember({ role: "owner" });
      const ws = owner.workspace.id;
      const join = async (role: string) => {
        const other = await createWorkspaceMember({ role: "owner" });
        await db.insert(schema.workspaceUserTable).values({
          workspaceId: ws,
          userId: other.user.id,
          role,
          joinedAt: new Date(),
        });
        return other.user;
      };
      const { app } = createApp();
      const create = (visibility?: string) => {
        mockAuthenticatedSession(owner.user);
        return app.request(
          "/api/view",
          json("POST", {
            workspaceId: ws,
            projectId: null,
            visibility,
            name: `${visibility ?? "default"} view`,
            filters: { matchAny: true },
            display: {},
          }),
        );
      };
      return { owner, ws, join, app, create };
    }

    it("hides personal views from other members; shared views are listed", async () => {
      const { owner, ws, join, app, create } = await setup();
      const personal = await (await create("personal")).json();
      const shared = await (await create("shared")).json();
      const legacy = await (await create()).json();
      expect(personal).toMatchObject({ visibility: "personal", canEdit: true });
      expect(legacy.visibility).toBe("shared");

      const list = async () =>
        (await (await app.request(`/api/view/workspace/${ws}`)).json()).map(
          (v: { id: string }) => v.id,
        );
      expect(await list()).toHaveLength(3);

      const teammate = await join("member");
      mockAuthenticatedSession(teammate);
      expect(await list()).toEqual(
        expect.arrayContaining([shared.id, legacy.id]),
      );
      expect(await list()).not.toContain(personal.id);
      expect(
        (await app.request(`/api/view/workspace/${ws}/${personal.id}`)).status,
      ).toBe(404);
      const seen = await (
        await app.request(`/api/view/workspace/${ws}/${shared.id}`)
      ).json();
      expect(seen).toMatchObject({
        canEdit: false,
        filters: { matchAny: true },
      });
      expect(owner.user.id).not.toBe(teammate.id);
    });

    it("lets only the owner edit, share or delete a shared view", async () => {
      const { owner, ws, join, app, create } = await setup();
      const shared = await (await create("shared")).json();
      const url = `/api/view/workspace/${ws}/${shared.id}`;

      mockAuthenticatedSession(await join("member"));
      expect((await app.request(url, json("PUT", { name: "x" }))).status).toBe(
        403,
      );
      expect(
        (await app.request(url, json("PUT", { visibility: "personal" })))
          .status,
      ).toBe(403);
      expect((await app.request(url, { method: "DELETE" })).status).toBe(403);

      mockAuthenticatedSession(owner.user);
      const flipped = await app.request(
        url,
        json("PUT", { visibility: "personal" }),
      );
      expect((await flipped.json()).visibility).toBe("personal");
    });

    it("denies non-members and viewers from creating views", async () => {
      const { ws, join, app } = await setup();
      const body = json("POST", {
        workspaceId: ws,
        projectId: null,
        name: "nope",
        filters: {},
        display: {},
      });

      const stranger = await createWorkspaceMember({ role: "owner" });
      mockAuthenticatedSession(stranger.user);
      // A workspace the caller isn't in is hidden (404) or forbidden (403).
      expect([403, 404]).toContain(
        (await app.request("/api/view", body)).status,
      );
      expect([403, 404]).toContain(
        (await app.request(`/api/view/workspace/${ws}`)).status,
      );

      mockAuthenticatedSession(await join("viewer"));
      expect((await app.request("/api/view", body)).status).toBe(403);
    });
  });
});
