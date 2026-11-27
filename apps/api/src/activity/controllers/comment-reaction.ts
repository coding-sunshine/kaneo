import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  activityTable,
  commentReactionTable,
  projectTable,
  taskTable,
} from "../../database/schema";
import { assertCustomEmojiExists } from "../../emoji/assert-custom-emoji";
import { publishEvent } from "../../events";

/** Adds or removes the user's emoji reaction; both are idempotent. */
async function setCommentReaction(
  userId: string,
  activityId: string,
  emoji: string,
  reacted: boolean,
) {
  const [comment] = await db
    .select({
      id: activityTable.id,
      taskId: activityTable.taskId,
      projectId: taskTable.projectId,
      workspaceId: projectTable.workspaceId,
    })
    .from(activityTable)
    .innerJoin(taskTable, eq(activityTable.taskId, taskTable.id))
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(
      and(eq(activityTable.id, activityId), eq(activityTable.type, "comment")),
    )
    .limit(1);

  if (!comment) {
    throw new HTTPException(404, { message: "Comment not found" });
  }

  // Removing stays allowed after the emoji is deleted from the workspace.
  if (reacted) await assertCustomEmojiExists(comment.workspaceId, emoji);

  if (reacted) {
    await db
      .insert(commentReactionTable)
      .values({ activityId, userId, emoji })
      .onConflictDoNothing();
  } else {
    await db
      .delete(commentReactionTable)
      .where(
        and(
          eq(commentReactionTable.activityId, activityId),
          eq(commentReactionTable.userId, userId),
          eq(commentReactionTable.emoji, emoji),
        ),
      );
  }

  await publishEvent("comment.updated", {
    id: comment.id,
    taskId: comment.taskId,
    projectId: comment.projectId,
    userId,
  });

  return { activityId, emoji, reacted };
}

export default setCommentReaction;
