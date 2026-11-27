import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import createActivity from "../../activity/controllers/create-activity";
import createComment from "../../activity/controllers/create-comment";
import db from "../../database";
import { projectTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { getClientUrl } from "../../github-reviews/config";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { loadMessage } from "./load-message";
import { messageTicketComment } from "./message-ticket-comment";

/**
 * Copies a chat message onto a ticket as the caller's comment, linking back
 * to the message, and records a system entry. The ticket must be in this
 * workspace and in a team the caller can open; any miss answers 404.
 */
export async function addMessageToTicket(
  workspaceId: string,
  channelId: string,
  messageId: string,
  userId: string,
  taskId: string,
) {
  const message = await loadMessage(
    workspaceId,
    channelId,
    messageId,
    userId,
    "read",
  );
  const [task] = await db
    .select({ projectId: taskTable.projectId })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(
      and(
        eq(taskTable.id, taskId),
        eq(projectTable.workspaceId, workspaceId),
        projectAccessCondition(userId, projectTable.id),
      ),
    )
    .limit(1);
  if (!task) throw new HTTPException(404, { message: "Task not found" });

  const link = `${getClientUrl()}/dashboard/workspace/${workspaceId}/channels/${channelId}?messageId=${messageId}`;
  const comment = await createComment(
    taskId,
    userId,
    messageTicketComment(message.body, link),
  );
  // Ids only: ticket readers may not be in the channel.
  await createActivity(taskId, "chat_message_added", userId, null, {
    channelId,
    messageId,
    commentId: comment.id,
  });
  // The system entry lands after the comment's event, so viewers refresh.
  await publishEvent("comment.updated", {
    id: comment.id,
    taskId,
    projectId: task.projectId,
    userId,
  });
  return comment;
}
