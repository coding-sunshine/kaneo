import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { taskDraftTable } from "../../apps/api/src/database/schema";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

describe("API integration: task drafts", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("creates, lists, updates and deletes a draft", async () => {
    const member = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const base = `/api/task-draft/workspace/${member.workspace.id}`;

    const created = await app.request(
      base,
      json("POST", { title: "Half done", properties: { priority: "high" } }),
    );
    expect(created.status).toBe(200);
    const draft = await created.json();
    expect(draft).toMatchObject({
      title: "Half done",
      properties: { priority: "high" },
    });

    const listed = await (await app.request(base)).json();
    expect(listed.map((d: { id: string }) => d.id)).toEqual([draft.id]);

    const updated = await app.request(
      `${base}/${draft.id}`,
      json("PUT", { title: "Done-ish", description: "body" }),
    );
    expect(await updated.json()).toMatchObject({
      title: "Done-ish",
      description: "body",
    });

    expect(
      (await app.request(`${base}/${draft.id}`, { method: "DELETE" })).status,
    ).toBe(200);
    expect(await (await app.request(base)).json()).toEqual([]);
  });

  it("keeps drafts private to their author", async () => {
    const member = await createWorkspaceMember({ role: "owner" });
    const other = await createWorkspaceMember({ role: "owner" });
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: member.workspace.id,
      userId: other.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    const { app } = createApp();
    const base = `/api/task-draft/workspace/${member.workspace.id}`;

    mockAuthenticatedSession(member.user);
    const draft = await (
      await app.request(base, json("POST", { title: "Secret" }))
    ).json();

    mockAuthenticatedSession(other.user);
    expect(await (await app.request(base)).json()).toEqual([]);
    expect(
      (
        await app.request(
          `${base}/${draft.id}`,
          json("PUT", { title: "Hijack" }),
        )
      ).status,
    ).toBe(404);
    expect(
      (await app.request(`${base}/${draft.id}`, { method: "DELETE" })).status,
    ).toBe(404);

    const [row] = await db
      .select()
      .from(taskDraftTable)
      .where(eq(taskDraftTable.id, draft.id));
    expect(row.title).toBe("Secret");
  });

  it("hides drafts untouched for more than 180 days", async () => {
    const member = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const base = `/api/task-draft/workspace/${member.workspace.id}`;
    const day = 24 * 60 * 60 * 1000;
    await db.insert(taskDraftTable).values([
      {
        workspaceId: member.workspace.id,
        userId: member.user.id,
        title: "stale",
        updatedAt: new Date(Date.now() - 181 * day),
      },
      {
        workspaceId: member.workspace.id,
        userId: member.user.id,
        title: "fresh",
        updatedAt: new Date(Date.now() - 179 * day),
      },
    ]);
    const listed = await (await app.request(base)).json();
    expect(listed.map((d: { title: string }) => d.title)).toEqual(["fresh"]);
  });
});
