import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { columnTable, taskTable } from "../../database/schema";
import { taskIsCompleted } from "../task-is-completed";

/** Linear's archives page: a project's archived tasks, newest archive first. */
export async function listArchivedTasks(projectId: string) {
  return db
    .select({
      id: taskTable.id,
      number: taskTable.number,
      title: taskTable.title,
      status: taskTable.status,
      priority: taskTable.priority,
      userId: taskTable.userId,
      archivedAt: taskTable.archivedAt,
    })
    .from(taskTable)
    .where(
      and(eq(taskTable.projectId, projectId), isNotNull(taskTable.archivedAt)),
    )
    .orderBy(desc(taskTable.archivedAt))
    .limit(500);
}

export async function unarchiveTask(taskId: string) {
  // updatedAt moves to now, so the scheduler gives the task a fresh period.
  const [task] = await db
    .update(taskTable)
    .set({ archivedAt: null })
    .where(and(eq(taskTable.id, taskId), isNotNull(taskTable.archivedAt)))
    .returning({ id: taskTable.id });
  if (!task)
    throw new HTTPException(404, { message: "Archived task not found" });
  return task;
}

/** Archive closed tasks untouched for the project's auto_archive_months (0 = off). */
export async function autoArchiveClosedTasks() {
  const rows = await db
    .update(taskTable)
    .set({ archivedAt: new Date(), updatedAt: sql`${taskTable.updatedAt}` })
    .where(
      and(
        isNull(taskTable.archivedAt),
        sql`coalesce((
          select ${columnTable.isFinal} from ${columnTable}
          where ${columnTable.id} = ${taskTable.columnId}
            and ${columnTable.projectId} = ${taskTable.projectId}
        ), ${taskIsCompleted})`,
        sql`exists (
          select 1 from project p
          where p.id = ${taskTable.projectId}
            and p.auto_archive_months > 0
            and ${taskTable.updatedAt} < (now() at time zone 'utc') - make_interval(months => p.auto_archive_months)
        )`,
      ),
    )
    .returning({ id: taskTable.id });
  return { archived: rows.length };
}
