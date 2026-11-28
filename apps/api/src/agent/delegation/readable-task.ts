import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable, taskTable } from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";

/**
 * A ticket of the workspace in a team the person can open. Any other ticket
 * answers 404, naming nothing.
 */
export async function readableTask(
  userId: string,
  workspaceId: string,
  taskId: string,
) {
  const [task] = await db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      description: taskTable.description,
      status: taskTable.status,
      number: taskTable.number,
      projectId: taskTable.projectId,
      creatorId: taskTable.creatorId,
      userId: taskTable.userId,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(
      and(
        eq(taskTable.id, taskId),
        eq(projectTable.workspaceId, workspaceId),
        projectAccessCondition(userId, projectTable.id),
      ),
    );
  if (!task) throw new HTTPException(404, { message: "Task not found" });
  return task;
}
