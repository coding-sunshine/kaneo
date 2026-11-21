import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  activityTable,
  commentThreadSubscriptionTable,
  taskTable,
} from "../../database/schema";
import { publishEvent } from "../../events";

/** Upserts the user's override on a thread's subscription. */
export async function upsertThreadSubscription(
  rootId: string,
  userId: string,
  subscribed: boolean,
) {
  await db
    .insert(commentThreadSubscriptionTable)
    .values({ activityId: rootId, userId, subscribed })
    .onConflictDoUpdate({
      target: [
        commentThreadSubscriptionTable.activityId,
        commentThreadSubscriptionTable.userId,
      ],
      set: { subscribed, updatedAt: new Date() },
    });
}

/** Subscribes or unsubscribes the user from the thread containing `activityId`. */
async function setThreadSubscription(
  userId: string,
  activityId: string,
  subscribed: boolean,
) {
  const [comment] = await db
    .select({
      id: activityTable.id,
      type: activityTable.type,
      parentId: activityTable.parentId,
      taskId: activityTable.taskId,
    })
    .from(activityTable)
    .where(eq(activityTable.id, activityId))
    .limit(1);

  if (!comment || comment.type !== "comment") {
    throw new HTTPException(404, { message: "Comment not found" });
  }

  const rootId = comment.parentId ?? comment.id;
  await upsertThreadSubscription(rootId, userId, subscribed);

  const [task] = await db
    .select({ projectId: taskTable.projectId })
    .from(taskTable)
    .where(eq(taskTable.id, comment.taskId))
    .limit(1);
  if (task) {
    await publishEvent("comment.updated", {
      id: rootId,
      taskId: comment.taskId,
      projectId: task.projectId,
      userId,
    });
  }

  return { activityId: rootId, subscribed };
}

export default setThreadSubscription;
