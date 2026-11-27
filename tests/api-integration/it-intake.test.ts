import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { savedViewTable } from "../../apps/api/src/database/schema";
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

async function setup() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const { project } = await createProjectFixture({
    workspaceId: owner.workspace.id,
  });
  mockAuthenticatedSession(owner.user);
  const { app } = createApp();
  return { owner, project, app };
}

describe("API integration: IT intake", () => {
  beforeEach(resetTestDatabase);

  it("sets up an IT request template, a required category and the IT queue", async () => {
    const { owner, project, app } = await setup();
    const workspaceId = owner.workspace.id;

    const setupResponse = await app.request(
      `/api/team-automation/it-intake/${project.id}`,
      json("POST"),
    );
    expect(setupResponse.status).toBe(200);
    // Running it again reuses what the first run made.
    const again = await app.request(
      `/api/team-automation/it-intake/${project.id}`,
      json("POST"),
    );
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual(await setupResponse.json());

    const columns = await (
      await app.request(`/api/column/${project.id}`)
    ).json();
    const triage = columns.filter(
      (column: { slug: string }) => column.slug === "triage",
    );
    expect(triage).toHaveLength(1);

    const templates = await (
      await app.request(`/api/issue-template/project/${project.id}`)
    ).json();
    const template = templates.filter(
      (candidate: { name: string }) => candidate.name === "IT request",
    );
    expect(template).toHaveLength(1);
    expect(template[0]).toMatchObject({
      priority: "high",
      columnId: triage[0].id,
    });

    const fields = await (
      await app.request(`/api/custom-field/project/${project.id}`)
    ).json();
    const category = fields.filter(
      (field: { name: string }) => field.name === "Category",
    );
    expect(category).toHaveLength(1);
    expect(category[0]).toMatchObject({ type: "dropdown", required: true });

    const views = await (
      await app.request(`/api/view/workspace/${workspaceId}`)
    ).json();
    const queue = views.filter(
      (view: { name: string }) => view.name === "IT queue",
    );
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      projectId: project.id,
      visibility: "shared",
      filters: { status: ["triage"] },
      display: { layout: "list", preset: "it-queue" },
    });

    const taskInput = {
      title: "Replace a laptop",
      description: "",
      priority: template[0].priority,
      status: triage[0].slug,
    };
    const missingCategory = await app.request(
      `/api/task/${project.id}`,
      json("POST", taskInput),
    );
    expect(missingCategory.status).toBe(400);

    const created = await app.request(
      `/api/task/${project.id}`,
      json("POST", {
        ...taskInput,
        customFields: [{ fieldId: category[0].id, value: "Hardware" }],
      }),
    );
    expect(created.status).toBe(200);
    const task = await created.json();
    expect(task).toMatchObject({ status: "triage", priority: "high" });

    // The setup turns SLAs on, so a high priority request gets a deadline.
    await vi.waitFor(async () => {
      const [row] = await db
        .select()
        .from(schema.taskTable)
        .where(eq(schema.taskTable.id, task.id));
      expect(row?.slaDueAt?.getTime()).toBeGreaterThan(Date.now());
    }, 10_000);
  });

  it("denies members without team update permission and non-members", async () => {
    const { owner, project } = await setup();
    const viewer = await createWorkspaceMember({ role: "viewer" });
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: owner.workspace.id,
      userId: viewer.user.id,
      role: "viewer",
      joinedAt: new Date(),
    });
    const outsider = await createWorkspaceMember({ role: "owner" });
    for (const [user, status] of [
      [viewer.user, 403],
      [outsider.user, 404],
    ] as const) {
      mockAuthenticatedSession(user);
      const { app } = createApp();
      const response = await app.request(
        `/api/team-automation/it-intake/${project.id}`,
        json("POST"),
      );
      expect(response.status).toBe(status);
    }
    expect(
      await db
        .select()
        .from(schema.issueTemplateTable)
        .where(eq(schema.issueTemplateTable.projectId, project.id)),
    ).toHaveLength(0);
    expect(await db.select().from(savedViewTable)).toHaveLength(0);
  });
});
