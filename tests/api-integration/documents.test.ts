import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
  type SeededMemberContext,
} from "./helpers/fixtures";

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

type User = SeededMemberContext["user"];

async function setup() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const other = await createWorkspaceMember();
  const ws = owner.workspace.id;
  await db.insert(schema.workspaceUserTable).values({
    workspaceId: ws,
    userId: other.user.id,
    role: "member",
    joinedAt: new Date(),
  });
  const { app } = createApp();
  const as = (user: User) => {
    mockAuthenticatedSession(user);
    return (path: string, init?: ReturnType<typeof json>) =>
      app.request(`/api/document${path}`, init);
  };
  return { ws, owner: owner.user, other: other.user, as };
}

describe("API integration: documents", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("keeps a private document hidden until it is shared, and hides it again", async () => {
    const { ws, owner, other, as } = await setup();
    const created = await as(owner)(
      "",
      json("POST", { workspaceId: ws, title: "Plan", content: "<p>v1</p>" }),
    );
    expect(created.status).toBe(200);
    const doc = await created.json();
    expect(doc).toMatchObject({
      scope: "private",
      role: "owner",
      subscriberIds: [owner.id],
    });
    const one = `/workspace/${ws}/${doc.id}`;

    expect(
      await (await as(owner)(`/workspace/${ws}?filter=mine`)).json(),
    ).toHaveLength(1);
    expect(
      await (await as(other)(`/workspace/${ws}?filter=shared`)).json(),
    ).toHaveLength(0);
    expect((await as(other)(one)).status).toBe(404);
    expect(
      (await as(other)(one, json("PATCH", { title: "Mine now" }))).status,
    ).toBe(404);
    expect((await as(other)(`${one}/comments`)).status).toBe(404);

    const shared = await as(owner)(
      `${one}/share/${other.id}`,
      json("PUT", { access: "view" }),
    );
    expect(shared.status).toBe(200);
    expect((await shared.json()).shares).toMatchObject([
      { userId: other.id, access: "view" },
    ]);
    expect(
      await (await as(other)(`/workspace/${ws}?filter=shared`)).json(),
    ).toHaveLength(1);
    expect((await (await as(other)(one)).json()).role).toBe("view");
    expect(
      (await as(other)(one, json("PATCH", { title: "Nope" }))).status,
    ).toBe(403);
    expect(
      (
        await as(other)(
          `${one}/comments`,
          json("POST", { content: "<p>hi</p>" }),
        )
      ).status,
    ).toBe(403);

    await as(owner)(
      `${one}/share/${other.id}`,
      json("PUT", { access: "comment" }),
    );
    expect(
      (
        await as(other)(
          `${one}/comments`,
          json("POST", { content: "<p>hi</p>" }),
        )
      ).status,
    ).toBe(200);

    // A non-creator cannot make it private; the creator can, which drops shares.
    await as(owner)(
      `${one}/share/${other.id}`,
      json("PUT", { access: "edit" }),
    );
    expect(
      (await as(other)(`${one}/location`, json("PUT", { scope: "private" })))
        .status,
    ).toBe(403);
    const moved = await as(owner)(
      `${one}/location`,
      json("PUT", { scope: "private" }),
    );
    expect((await moved.json()).shares).toEqual([]);
    expect((await as(other)(one)).status).toBe(404);
  });

  it("shows workspace documents to everyone and respects general access", async () => {
    const { ws, owner, other, as } = await setup();
    const doc = await (
      await as(owner)("", json("POST", { workspaceId: ws, title: "Wiki" }))
    ).json();
    const one = `/workspace/${ws}/${doc.id}`;
    await as(owner)(`${one}/location`, json("PUT", { scope: "workspace" }));

    // Linear's tabs: a workspace document is not "shared with me" and only
    // reaches Recent once I work on it.
    const list = async (filter: string) =>
      (await as(other)(`/workspace/${ws}?filter=${filter}`)).json();
    expect(await list("shared")).toEqual([]);
    expect(await list("recent")).toEqual([]);
    expect((await (await as(other)(one)).json()).role).toBe("edit");
    expect(
      (await as(other)(one, json("PATCH", { content: "<p>edit</p>" }))).status,
    ).toBe(200);
    expect(await list("recent")).toMatchObject([
      { id: doc.id, scope: "workspace" },
    ]);
    expect(await list("mine")).toEqual([]);

    await as(owner)(one, json("PATCH", { generalAccess: "view" }));
    expect((await (await as(other)(one)).json()).role).toBe("view");
    expect(
      (await as(other)(one, json("PATCH", { content: "<p>again</p>" }))).status,
    ).toBe(403);
  });

  it("hides team documents from members without team access", async () => {
    const { ws, owner, other, as } = await setup();
    const { project } = await createProjectFixture({ workspaceId: ws });
    const doc = await (
      await as(owner)(
        "",
        json("POST", { workspaceId: ws, title: "Team", projectId: project.id }),
      )
    ).json();
    expect(doc).toMatchObject({
      scope: "team",
      projectId: project.id,
      parentName: project.name,
    });
    expect(
      await (
        await as(other)(`/workspace/${ws}?projectId=${project.id}`)
      ).json(),
    ).toMatchObject([{ id: doc.id, parentName: project.name }]);

    await db.insert(schema.workspaceMemberAccessTable).values({
      workspaceId: ws,
      userId: other.id,
      projectAccess: "selected",
    });
    expect(
      await (
        await as(other)(`/workspace/${ws}?projectId=${project.id}`)
      ).json(),
    ).toHaveLength(0);
    expect((await as(other)(`/workspace/${ws}/${doc.id}`)).status).toBe(404);
    expect(
      (
        await as(other)(
          "",
          json("POST", {
            workspaceId: ws,
            title: "Sneaky",
            projectId: project.id,
          }),
        )
      ).status,
    ).not.toBe(200);
  });

  it("rejects parents from another workspace", async () => {
    const { ws, owner, as } = await setup();
    const foreign = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: foreign.workspace.id,
    });
    expect(
      (
        await as(owner)(
          "",
          json("POST", { workspaceId: ws, projectId: project.id }),
        )
      ).status,
    ).toBe(400);
  });

  it("folds quick edits into one version and restores old ones", async () => {
    const { ws, owner, as } = await setup();
    const doc = await (
      await as(owner)(
        "",
        json("POST", { workspaceId: ws, content: "<p>a</p>" }),
      )
    ).json();
    const one = `/workspace/${ws}/${doc.id}`;
    await as(owner)(one, json("PATCH", { content: "<p>b</p>" }));
    await as(owner)(one, json("PATCH", { content: "<p>c</p>" }));
    let versions = await (await as(owner)(`${one}/versions`)).json();
    expect(versions).toHaveLength(1);
    expect(versions[0].content).toBe("<p>c</p>");

    // Age the entry past the fold window.
    await db
      .update(schema.documentVersionTable)
      .set({ updatedAt: new Date(Date.now() - 60 * 60 * 1000) })
      .where(eq(schema.documentVersionTable.documentId, doc.id));
    await as(owner)(one, json("PATCH", { content: "<p>d</p>" }));
    versions = await (await as(owner)(`${one}/versions`)).json();
    expect(versions.map((v: { content: string }) => v.content)).toEqual([
      "<p>d</p>",
      "<p>c</p>",
    ]);

    const restored = await as(owner)(
      `${one}/versions/${versions[1].id}/restore`,
      json("POST"),
    );
    expect((await restored.json()).content).toBe("<p>c</p>");
    expect(await (await as(owner)(`${one}/versions`)).json()).toHaveLength(3);
  });

  it("threads comments one level, resolves roots and notifies", async () => {
    const { ws, owner, other, as } = await setup();
    const doc = await (
      await as(owner)("", json("POST", { workspaceId: ws, title: "Spec" }))
    ).json();
    const one = `/workspace/${ws}/${doc.id}`;
    const mention = `<p><kaneo-mention id="${other.id}">@x</kaneo-mention></p>`;

    // Private: the mentioned user cannot see it, so no notification.
    const root = await (
      await as(owner)(
        `${one}/comments`,
        json("POST", { content: mention, quotedText: "scope" }),
      )
    ).json();
    expect(root).toMatchObject({ quotedText: "scope", parentId: null });
    const notifications = () =>
      db
        .select()
        .from(schema.notificationTable)
        .where(
          and(
            eq(schema.notificationTable.userId, other.id),
            eq(schema.notificationTable.resourceType, "document"),
          ),
        );
    expect(await notifications()).toHaveLength(0);

    await as(owner)(`${one}/location`, json("PUT", { scope: "workspace" }));
    const reply = await (
      await as(owner)(
        `${one}/comments`,
        json("POST", { content: mention, parentId: root.id }),
      )
    ).json();
    expect(await notifications()).toMatchObject([
      {
        type: "document_mention",
        resourceId: doc.id,
        eventData: { documentTitle: "Spec", commentPreview: mention },
      },
    ]);

    expect(
      (
        await as(owner)(
          `${one}/comments`,
          json("POST", { content: "<p>x</p>", parentId: reply.id }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await as(owner)(
          `${one}/comments/${reply.id}`,
          json("PATCH", { resolved: true }),
        )
      ).status,
    ).toBe(400);
    const resolved = await as(other)(
      `${one}/comments/${root.id}`,
      json("PATCH", { resolved: true }),
    );
    expect((await resolved.json()).resolvedById).toBe(other.id);
    expect(
      (await as(other)(`${one}/comments/${root.id}`, json("DELETE"))).status,
    ).toBe(403);

    expect(
      (await as(owner)(`${one}/comments/${root.id}`, json("DELETE"))).status,
    ).toBe(200);
    expect(await (await as(owner)(`${one}/comments`)).json()).toEqual([]);
  });

  it("only subscribes people who can see the document", async () => {
    const { ws, owner, other, as } = await setup();
    const doc = await (
      await as(owner)("", json("POST", { workspaceId: ws }))
    ).json();
    const one = `/workspace/${ws}/${doc.id}`;
    expect(
      (
        await as(owner)(
          `${one}/subscribers`,
          json("PUT", { userIds: [owner.id, other.id] }),
        )
      ).status,
    ).toBe(400);
    await as(owner)(
      `${one}/share/${other.id}`,
      json("PUT", { access: "view" }),
    );
    const set = await as(owner)(
      `${one}/subscribers`,
      json("PUT", { userIds: [other.id] }),
    );
    expect(await set.json()).toEqual({ subscriberIds: [other.id] });
  });

  it("soft deletes and restores", async () => {
    const { ws, owner, as } = await setup();
    const doc = await (
      await as(owner)("", json("POST", { workspaceId: ws }))
    ).json();
    const one = `/workspace/${ws}/${doc.id}`;
    expect((await as(owner)(one, json("DELETE"))).status).toBe(200);
    expect((await as(owner)(one)).status).toBe(404);
    expect(
      await (await as(owner)(`/workspace/${ws}?filter=mine`)).json(),
    ).toEqual([]);
    expect((await as(owner)(`${one}/restore`, json("POST"))).status).toBe(200);
    expect((await as(owner)(one)).status).toBe(200);
  });
});
