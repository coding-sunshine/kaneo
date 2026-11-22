import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const json = { "Content-Type": "application/json" };

async function setup() {
  const member = await createWorkspaceMember({ role: "owner" });
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({ projectId: project.id, title: "Task" })
    .returning();
  mockAuthenticatedSession(member.user);
  return { member, project, task };
}

const putEstimate = (id: string, estimate: number | null) =>
  createApp().app.request(`/api/task/estimate/${id}`, {
    method: "PUT",
    headers: json,
    body: JSON.stringify({ estimate }),
  });

const configure = (
  projectId: string,
  workspaceId: string,
  project: typeof schema.projectTable.$inferSelect,
  body: Record<string, unknown>,
) =>
  createApp().app.request(
    `/api/project/${projectId}?workspaceId=${workspaceId}`,
    {
      method: "PUT",
      headers: json,
      body: JSON.stringify({
        name: project.name,
        icon: project.icon,
        slug: project.slug,
        description: "",
        isPublic: false,
        ...body,
      }),
    },
  );

describe("API integration: task estimates", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("rejects estimates while the team does not use them", async () => {
    const { task } = await setup();
    expect((await putEstimate(task.id, 3)).status).toBe(400);
    expect((await putEstimate(task.id, null)).status).toBe(200);
  });

  it("saves the team's scale and exposes its options", async () => {
    const { member, project } = await setup();
    const response = await configure(project.id, member.workspace.id, project, {
      estimateType: "fibonacci",
      estimateAllowZero: true,
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.estimateType).toBe("fibonacci");
    expect(body.estimateOptions.map((o: { value: number }) => o.value)).toEqual(
      [0, 1, 2, 3, 5, 8],
    );
  });

  it("accepts points on the scale and rejects others", async () => {
    const { member, project, task } = await setup();
    await configure(project.id, member.workspace.id, project, {
      estimateType: "fibonacci",
    });

    const ok = await putEstimate(task.id, 5);
    expect(ok.status).toBe(200);
    expect((await ok.json()).estimate).toBe(5);
    expect((await putEstimate(task.id, 4)).status).toBe(400);
    expect((await putEstimate(task.id, 0)).status).toBe(400);

    const cleared = await putEstimate(task.id, null);
    expect((await cleared.json()).estimate).toBeNull();
  });

  it("returns the estimate on the board", async () => {
    const { member, project, task } = await setup();
    await configure(project.id, member.workspace.id, project, {
      estimateType: "linear",
    });
    await putEstimate(task.id, 2);
    const response = await createApp().app.request(
      `/api/task/tasks/${project.id}?page=1&limit=100`,
    );
    const board = await response.json();
    const tasks = board.data.columns.flatMap(
      (column: { tasks: { id: string; estimate: number | null }[] }) =>
        column.tasks,
    );
    expect(tasks.find((t: { id: string }) => t.id === task.id).estimate).toBe(
      2,
    );
  });
});
