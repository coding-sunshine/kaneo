import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(resetTestDatabase);

async function fixture(role = "admin") {
  const member = await createWorkspaceMember({ role });
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  mockAuthenticatedSession(member.user);
  const { app } = createApp();
  const request = (path: string, method = "GET", body?: unknown) =>
    app.request(`/api${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  return { member, project, columns, request };
}

describe("issue templates API", () => {
  it("creates, lists, updates and deletes a template", async () => {
    const { member, project, columns, request } = await fixture();
    const created = await request("/issue-template", "POST", {
      projectId: project.id,
      name: "Bug report",
      title: "Bug: ",
      description: "Steps to reproduce",
      columnId: columns.inProgress.id,
      priority: "high",
      assigneeId: member.user.id,
      labels: [{ name: "bug", color: "red" }],
    });
    expect(created.status).toBe(200);
    const template = await created.json();
    expect(template).toMatchObject({
      name: "Bug report",
      priority: "high",
      columnId: columns.inProgress.id,
      labels: [{ name: "bug", color: "red" }],
    });

    const list = await (
      await request(`/issue-template/project/${project.id}`)
    ).json();
    expect(list.map((t: { id: string }) => t.id)).toEqual([template.id]);

    const updated = await request(`/issue-template/${template.id}`, "PUT", {
      name: "Defect",
      columnId: null,
    });
    expect(await updated.json()).toMatchObject({
      name: "Defect",
      columnId: null,
      priority: "high",
    });

    expect(
      (await request(`/issue-template/${template.id}`, "DELETE")).status,
    ).toBe(200);
    expect(await db.select().from(schema.issueTemplateTable)).toEqual([]);
  });

  it("rejects a status from another team", async () => {
    const { member, project, request } = await fixture();
    const other = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const response = await request("/issue-template", "POST", {
      projectId: project.id,
      name: "Bad",
      columnId: other.columns.todo.id,
    });
    expect(response.status).toBe(400);
  });

  it("lets a member read but not write templates", async () => {
    const { member, project, request } = await fixture("member");
    const [template] = await db
      .insert(schema.issueTemplateTable)
      .values({ projectId: project.id, name: "Existing" })
      .returning();
    expect(
      (await request(`/issue-template/project/${project.id}`)).status,
    ).toBe(200);
    expect(
      (
        await request("/issue-template", "POST", {
          projectId: project.id,
          name: "Nope",
        })
      ).status,
    ).toBe(403);
    expect(
      (await request(`/issue-template/${template.id}`, "PUT", { name: "x" }))
        .status,
    ).toBe(403);
    expect(
      (await request(`/issue-template/${template.id}`, "DELETE")).status,
    ).toBe(403);
    const [still] = await db
      .select()
      .from(schema.issueTemplateTable)
      .where(eq(schema.issueTemplateTable.id, template.id));
    expect(still?.name).toBe("Existing");
    expect(member.user.id).toBeTruthy();
  });

  it("hides templates from non-members of the workspace", async () => {
    const { project, request } = await fixture();
    const outsider = await createWorkspaceMember({ role: "admin" });
    mockAuthenticatedSession(outsider.user);
    expect(
      (await request(`/issue-template/project/${project.id}`)).status,
    ).toBe(404);
  });
});

describe("copy settings from another team", () => {
  it("copies statuses, estimates, cycles and templates", async () => {
    const { member, project, columns, request } = await fixture();
    await db
      .update(schema.projectTable)
      .set({
        estimateType: "fibonacci",
        cyclesEnabled: true,
        cycleDurationWeeks: 3,
      })
      .where(eq(schema.projectTable.id, project.id));
    await db.insert(schema.issueTemplateTable).values({
      projectId: project.id,
      name: "Bug",
      columnId: columns.done.id,
    });
    await db
      .update(schema.columnTable)
      .set({ name: "Shipped" })
      .where(eq(schema.columnTable.id, columns.done.id));

    const response = await request("/project", "POST", {
      name: "Copy",
      slug: "cpy",
      icon: "Layout",
      workspaceId: member.workspace.id,
      copySettingsFromProjectId: project.id,
    });
    expect(response.status).toBe(200);
    const created = await response.json();
    expect(created).toMatchObject({
      estimateType: "fibonacci",
      cyclesEnabled: true,
      cycleDurationWeeks: 3,
    });

    const cols = await db
      .select()
      .from(schema.columnTable)
      .where(eq(schema.columnTable.projectId, created.id));
    expect(cols.map((c) => c.name).sort()).toEqual(
      ["In Progress", "In Review", "Shipped", "To Do"].sort(),
    );
    const [tpl] = await db
      .select()
      .from(schema.issueTemplateTable)
      .where(eq(schema.issueTemplateTable.projectId, created.id));
    const shipped = cols.find((c) => c.name === "Shipped");
    expect(tpl?.columnId).toBe(shipped?.id);
    expect(shipped?.id).not.toBe(columns.done.id);
  });

  it("rejects a source project from another workspace", async () => {
    const { member, request } = await fixture();
    const foreign = await createWorkspaceMember({ role: "admin" });
    const { project: foreignProject } = await createProjectFixture({
      workspaceId: foreign.workspace.id,
    });
    mockAuthenticatedSession(member.user);
    const response = await request("/project", "POST", {
      name: "Copy",
      slug: "cpy",
      icon: "Layout",
      workspaceId: member.workspace.id,
      copySettingsFromProjectId: foreignProject.id,
    });
    expect([403, 404]).toContain(response.status);
    const projects = await db
      .select()
      .from(schema.projectTable)
      .where(eq(schema.projectTable.workspaceId, member.workspace.id));
    expect(projects).toHaveLength(1);
  });

  it("still creates a project with defaults when nothing is copied", async () => {
    const { member, request } = await fixture();
    const response = await request("/project", "POST", {
      name: "Plain",
      slug: "pln",
      icon: "Layout",
      workspaceId: member.workspace.id,
    });
    const created = await response.json();
    const cols = await db
      .select()
      .from(schema.columnTable)
      .where(eq(schema.columnTable.projectId, created.id));
    expect(cols).toHaveLength(4);
  });
});
