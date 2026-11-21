import { eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { activityTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";

/**
 * Resolves or reopens the thread containing `activityId`. Resolving from a
 * reply records that reply as the thread's resolution, as Linear does.
 */
async function resolveCommentThread(
  userId: string,
  activityId: string,
  resolved: boolean,
) {
  const [comment] = await db
    .select({
      id: activityTable.id,
      type: activityTable.type,
      parentId: activityTable.parentId,
    })
    .from(activityTable)
    .where(eq(activityTable.id, activityId))
    .limit(1);

  if (!comment || comment.type !== "comment") {
    throw new HTTPException(404, { message: "Comment not found" });
  }

  const rootId = comment.parentId ?? comment.id;
  const [root] = await db
    .update(activityTable)
    .set({
      resolvedAt: resolved ? new Date() : null,
      resolvedByUserId: resolved ? userId : null,
      resolvingCommentId: resolved && comment.parentId ? comment.id : null,
      // Resolving is not an edit; keep updatedAt as the content's edit time.
      updatedAt: sql`${activityTable.updatedAt}`,
    })
    .where(eq(activityTable.id, rootId))
    .returning();

  if (!root) {
    throw new HTTPException(404, { message: "Comment not found" });
  }

  const [task] = await db
    .select({ projectId: taskTable.projectId })
    .from(taskTable)
    .where(eq(taskTable.id, root.taskId))
    .limit(1);
  if (task) {
    await publishEvent("comment.updated", {
      ...root,
      projectId: task.projectId,
      userId,
    });
  }

  return root;
}

export default resolveCommentThread;
