import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { projectTable, taskTable } from "../database/schema";
import { projectAccessCondition } from "../project-access/project-access-condition";

/** A ticket of the workspace the reader can open, or 404. */
export async function openTask(
  taskId: string,
  workspaceId: string,
  userId: string,
) {
  const [task] = await db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      projectId: taskTable.projectId,
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
