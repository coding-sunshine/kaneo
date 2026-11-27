import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import db from "../../database";
import { activityTable, projectTable, taskTable } from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";

// Home shows the list whole; a week of one person's completions fits.
export const DONE_TASKS_LIMIT = 50;

// The trigger stamps completed_at when a task enters a completed column and
// keeps it on later moves within that category, so the first status change at
// or after the stamp is the one that completed the task.
const completedBy = sql`(
  select ${activityTable.userId} from ${activityTable}
  where ${activityTable.taskId} = ${taskTable.id}
    and ${activityTable.type} = 'status_changed'
    and ${activityTable.createdAt} >= ${taskTable.completedAt}
  order by ${activityTable.createdAt} asc, ${activityTable.id} asc
  limit 1
)`;

async function getDoneTasks(workspaceId: string, userId: string, since: Date) {
  const myStatusChanges = db
    .select({ taskId: activityTable.taskId })
    .from(activityTable)
    .where(
      and(
        eq(activityTable.userId, userId),
        eq(activityTable.type, "status_changed"),
        gte(activityTable.createdAt, since),
      ),
    );

  const tasks = await db
    .select({
      id: taskTable.id,
      projectId: taskTable.projectId,
      number: taskTable.number,
      title: taskTable.title,
      completedAt: taskTable.completedAt,
      projectName: projectTable.name,
      projectSlug: projectTable.slug,
      projectIcon: projectTable.icon,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        inArray(taskTable.id, myStatusChanges),
        gte(taskTable.completedAt, since),
        sql`${completedBy} = ${userId}`,
        projectAccessCondition(userId, projectTable.id),
      ),
    )
    .orderBy(desc(taskTable.completedAt), desc(taskTable.id))
    .limit(DONE_TASKS_LIMIT);

  return { tasks };
}

export default getDoneTasks;
