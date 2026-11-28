import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { taskDuplicateDismissalTable } from "../../apps/api/src/database/schema";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";

type User = typeof schema.userTable.$inferSelect;
type Suggestion = { id: string; title: string; ticket: string };

const { app } = createApp();

async function setup() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const ws = owner.workspace.id;
  const web = await createProjectFixture({ workspaceId: ws, slug: "web" });
  let number = 0;
  const task = async (title: string, project = web) => {
    number += 1;
    const [row] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.project.id,
        title,
        status: "to-do",
        columnId: project.columns.todo.id,
        number,
      })
      .returning();
    return row;
  };
  return { owner: owner.user, ws, web, task };
}

async function suggestions(user: User, taskId: string) {
  mockAuthenticatedSession(user);
  return app.request(`/api/duplicate-suggestion/task/${taskId}`);
}

async function decline(user: User, taskId: string, otherTaskId: string) {
  mockAuthenticatedSession(user);
  return app.request(`/api/duplicate-suggestion/task/${taskId}/decline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ otherTaskId }),
  });
}

const titles = async (response: Response) =>
  ((await response.json()) as { suggestions: Suggestion[] }).suggestions.map(
    (s) => s.title,
  );

describe("API integration: duplicate suggestions", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("suggests an open ticket with a close title and nothing unrelated", async () => {
    const { owner, task } = await setup();
    const existing = await task("Login page crashes on Safari");
    await task("Update billing email copy");
    const fresh = await task("Login page crash in Safari");
    const response = await suggestions(owner, fresh.id);
    expect(response.status, await response.clone().text()).toBe(200);
    const body = (await response.json()) as { suggestions: Suggestion[] };
    expect(body.suggestions).toEqual([
      expect.objectContaining({
        id: existing.id,
        title: "Login page crashes on Safari",
        ticket: `WEB-${existing.number}`,
      }),
    ]);
  });

  it("accepting sets a duplicate relation and the suggestion goes away", async () => {
    const { owner, task } = await setup();
    const existing = await task("Login page crashes on Safari");
    const fresh = await task("Login page crash in Safari");
    mockAuthenticatedSession(owner);
    const accepted = await app.request("/api/task-relation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceTaskId: fresh.id,
        targetTaskId: existing.id,
        relationType: "duplicate",
      }),
    });
    expect(accepted.status, await accepted.clone().text()).toBe(200);
    const relations = await db.select().from(schema.taskRelationTable);
    expect(relations).toEqual([
      expect.objectContaining({
        sourceTaskId: fresh.id,
        targetTaskId: existing.id,
        relationType: "duplicate",
      }),
    ]);
    expect(await titles(await suggestions(owner, fresh.id))).toEqual([]);
  });

  it("declining hides that pair from both tickets, and only that pair", async () => {
    const { owner, task } = await setup();
    const existing = await task("Login page crashes on Safari");
    const other = await task("Login page crashes in Safari");
    const fresh = await task("Login page crash in Safari");
    const response = await decline(owner, fresh.id, existing.id);
    expect(response.status, await response.clone().text()).toBe(200);
    // Declining twice is fine.
    expect((await decline(owner, fresh.id, existing.id)).status).toBe(200);
    expect(await titles(await suggestions(owner, fresh.id))).toEqual([
      "Login page crashes in Safari",
    ]);
    expect(await titles(await suggestions(owner, existing.id))).not.toContain(
      "Login page crash in Safari",
    );
    expect(await db.select().from(schema.taskRelationTable)).toEqual([]);
    expect(other).toBeTruthy();
  });

  it("never suggests a ticket in a team the caller cannot open", async () => {
    const { owner, ws, web, task } = await setup();
    const hidden = await createProjectFixture({ workspaceId: ws });
    await task("Login page crashes on Safari", hidden);
    const fresh = await task("Login page crash in Safari");
    const member = (await createWorkspaceMember()).user;
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: member.id,
      role: "member",
      joinedAt: new Date(),
    });
    await restrictToProjects(ws, member.id, [web.project.id]);
    expect(await titles(await suggestions(member, fresh.id))).toEqual([]);
    expect(await titles(await suggestions(owner, fresh.id))).toEqual([
      "Login page crashes on Safari",
    ]);
  });

  it("refuses declining against a ticket the caller cannot open", async () => {
    const { owner, ws, web, task } = await setup();
    const hidden = await createProjectFixture({ workspaceId: ws });
    const secret = await task("Login page crashes on Safari", hidden);
    const fresh = await task("Login page crash in Safari");
    const member = (await createWorkspaceMember()).user;
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: member.id,
      role: "member",
      joinedAt: new Date(),
    });
    await restrictToProjects(ws, member.id, [web.project.id]);
    expect((await decline(member, fresh.id, secret.id)).status).toBe(404);
    expect(await db.select().from(taskDuplicateDismissalTable)).toEqual([]);
    expect(owner).toBeTruthy();
  });

  it("lets a viewer see suggestions but not decline them", async () => {
    const { ws, task } = await setup();
    const existing = await task("Login page crashes on Safari");
    const fresh = await task("Login page crash in Safari");
    const viewer = (await createWorkspaceMember()).user;
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: viewer.id,
      role: "viewer",
      joinedAt: new Date(),
    });
    expect(await titles(await suggestions(viewer, fresh.id))).toEqual([
      "Login page crashes on Safari",
    ]);
    expect((await decline(viewer, fresh.id, existing.id)).status).toBe(403);
    expect(await db.select().from(taskDuplicateDismissalTable)).toEqual([]);
  });

  it("refuses a ticket of another workspace", async () => {
    const { task } = await setup();
    const fresh = await task("Login page crash in Safari");
    const stranger = await createWorkspaceMember({ role: "owner" });
    expect((await suggestions(stranger.user, fresh.id)).status).toBe(404);
    expect((await decline(stranger.user, fresh.id, fresh.id)).status).toBe(404);
  });
});
