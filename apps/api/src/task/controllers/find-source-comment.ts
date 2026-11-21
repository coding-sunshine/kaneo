import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { activityTable, projectTable, taskTable } from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";

// A new task may point back at a comment only when its creator can see that
// comment, in the same workspace.
export async function findSourceComment(
  commentId: string,
  workspaceId: string,
  userId: string,
) {
  const [comment] = await db
    .select({ taskId: activityTable.taskId, projectId: taskTable.projectId })
    .from(activityTable)
    .innerJoin(taskTable, eq(activityTable.taskId, taskTable.id))
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(
      and(
        eq(activityTable.id, commentId),
        eq(activityTable.type, "comment"),
        eq(projectTable.workspaceId, workspaceId),
        projectAccessCondition(userId, projectTable.id),
      ),
    )
    .limit(1);
  if (!comment)
    throw new HTTPException(400, { message: "Source comment not found" });
  return comment;
}
