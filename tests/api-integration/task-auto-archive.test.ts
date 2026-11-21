import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { autoArchiveClosedTasks } from "../../apps/api/src/task/controllers/task-archive";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const monthsAgo = (months: number) => {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() - months);
  return date;
};

async function seed(autoArchiveMonths: number) {
  const member = await createWorkspaceMember();
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  await db
    .update(schema.projectTable)
    .set({ autoArchiveMonths })
    .where(eq(schema.projectTable.id, project.id));

  const task = (
    number: number,
    title: string,
    column: typeof columns.todo,
    updatedAt: Date,
  ) => ({
    projectId: project.id,
    number,
    title,
    status: column.slug,
    columnId: column.id,
    updatedAt,
  });
  const rows = await db
    .insert(schema.taskTable)
    .values([
      task(1, "closed old", columns.done, monthsAgo(8)),
      task(2, "closed recent", columns.done, monthsAgo(2)),
      task(3, "open old", columns.todo, monthsAgo(8)),
    ])
    .returning();
  return Object.fromEntries(rows.map((row) => [row.title, row.id]));
}

async function archivedTitles() {
  const rows = await db
    .select({
      title: schema.taskTable.title,
      archivedAt: schema.taskTable.archivedAt,
    })
    .from(schema.taskTable);
  return rows.filter((row) => row.archivedAt).map((row) => row.title);
}

describe("API integration: auto-archive closed tasks", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("archives only closed tasks older than auto_archive_months", async () => {
    await seed(6);

    expect(await autoArchiveClosedTasks()).toEqual({ archived: 1 });
    expect(await archivedTitles()).toEqual(["closed old"]);
  });

  it("keeps updated_at so the archive does not reset the clock", async () => {
    const ids = await seed(6);

    await autoArchiveClosedTasks();

    const [task] = await db
      .select({ updatedAt: schema.taskTable.updatedAt })
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, ids["closed old"] as string));
    expect(task?.updatedAt.getTime()).toBeLessThan(monthsAgo(7).getTime());
  });

  it("does nothing when auto_archive_months is 0", async () => {
    await seed(0);

    expect(await autoArchiveClosedTasks()).toEqual({ archived: 0 });
    expect(await archivedTitles()).toEqual([]);
  });

  it("is idempotent", async () => {
    await seed(6);

    await autoArchiveClosedTasks();
    expect(await autoArchiveClosedTasks()).toEqual({ archived: 0 });
  });
});
