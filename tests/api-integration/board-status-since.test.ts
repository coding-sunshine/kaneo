import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

type BoardTask = { id: string; statusSince?: string | null };
type Board = { columns: Array<{ tasks: BoardTask[] }> };

const DAY = 86_400_000;

async function setup() {
  const member = await createWorkspaceMember();
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const created = new Date(Date.now() - 20 * DAY);
  const [moved, untouched] = await db
    .insert(schema.taskTable)
    .values(
      ["Moved to review", "Never moved"].map((title, index) => ({
        projectId: project.id,
        title,
        status: index === 0 ? "in-review" : "to-do",
        columnId: index === 0 ? columns.inReview.id : columns.todo.id,
        priority: "low",
        number: index + 1,
        position: index + 1,
        createdAt: created,
      })),
    )
    .returning();
  if (!moved || !untouched) throw new Error("missing tasks");
  const enteredReview = new Date(Date.now() - 9 * DAY);
  await db.insert(schema.activityTable).values([
    {
      taskId: moved.id,
      type: "status_changed",
      userId: member.user.id,
      eventData: { oldStatus: "to-do", newStatus: "in-progress" },
      createdAt: new Date(Date.now() - 15 * DAY),
    },
    {
      taskId: moved.id,
      type: "status_changed",
      userId: member.user.id,
      eventData: { oldStatus: "in-progress", newStatus: "in-review" },
      createdAt: enteredReview,
    },
  ]);
  return { member, project, moved, untouched, created, enteredReview };
}

const tasksOf = (board: Board) =>
  new Map(
    board.columns.flatMap((column) => column.tasks).map((t) => [t.id, t]),
  );

describe("API integration: board status since", () => {
  beforeEach(resetTestDatabase);

  it("stamps each board task with when it entered its current status", async () => {
    const { member, project, moved, untouched, created, enteredReview } =
      await setup();
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(`/api/task/tasks/${project.id}`);
    expect(response.status).toBe(200);
    const tasks = tasksOf(((await response.json()) as { data: Board }).data);

    expect(tasks.get(moved.id)?.statusSince).toBe(enteredReview.toISOString());
    expect(tasks.get(untouched.id)?.statusSince).toBe(created.toISOString());

    const single = await app.request(`/api/task/${moved.id}?view=board`);
    expect(single.status).toBe(200);
    expect(((await single.json()) as BoardTask).statusSince).toBe(
      enteredReview.toISOString(),
    );
  });

  it("leaves status history off public boards", async () => {
    const { project, moved } = await setup();
    await db
      .update(schema.projectTable)
      .set({ isPublic: true })
      .where(eq(schema.projectTable.id, project.id));
    mockAnonymousSession();
    const { app } = createApp();

    const response = await app.request(`/api/public-project/${project.id}`);
    expect(response.status).toBe(200);
    const board = (await response.json()) as Board;
    expect(tasksOf(board).get(moved.id)?.statusSince ?? null).toBeNull();
  });
});
