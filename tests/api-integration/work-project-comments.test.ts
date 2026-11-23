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

describe("API integration: work project comments", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("creates, lists, edits and deletes own comments; others are forbidden", async () => {
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
    const as = (user: typeof author) => {
      mockAuthenticatedSession(user);
      return createApp().app;
    };
    const p = await (
      await as(owner.user).request(
        "/api/work-project",
        json("POST", { workspaceId: owner.workspace.id, name: "P" }),
      )
    ).json();

    const posted = await as(author).request(
      `/api/work-project/${p.id}/comment`,
      json("POST", { content: "First" }),
    );
    expect(posted.status).toBe(200);
    const first = await posted.json();
    expect(first).toMatchObject({ content: "First", userId: author.id });
    expect(
      (
        await as(author).request(
          `/api/work-project/${p.id}/comment`,
          json("POST", { content: "   " }),
        )
      ).status,
    ).toBe(400);
    await as(other).request(
      `/api/work-project/${p.id}/comment`,
      json("POST", { content: "Second" }),
    );

    const list = await (
      await as(owner.user).request(`/api/work-project/${p.id}/comment`)
    ).json();
    expect(list.map((c: { content: string }) => c.content)).toEqual([
      "First",
      "Second",
    ]);

    // non-author: 403 on edit and delete; admin may delete but not edit
    expect(
      (
        await as(other).request(
          `/api/work-project/comment/${first.id}`,
          json("PUT", { content: "x" }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await as(other).request(
          `/api/work-project/comment/${first.id}`,
          json("DELETE"),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await as(owner.user).request(
          `/api/work-project/comment/${first.id}`,
          json("PUT", { content: "x" }),
        )
      ).status,
    ).toBe(403);

    const edited = await as(author).request(
      `/api/work-project/comment/${first.id}`,
      json("PUT", { content: "Edited" }),
    );
    expect(edited.status).toBe(200);
    expect(await edited.json()).toMatchObject({ content: "Edited" });

    expect(
      (
        await as(author).request(
          `/api/work-project/comment/${first.id}`,
          json("DELETE"),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await as(author).request(
          `/api/work-project/comment/${first.id}`,
          json("DELETE"),
        )
      ).status,
    ).toBe(404);
    const after = await (
      await as(owner.user).request(`/api/work-project/${p.id}/comment`)
    ).json();
    expect(after).toHaveLength(1);
  });
});
