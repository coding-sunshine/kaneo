import { and, eq, sql } from "drizzle-orm";
import db from "../../database";
import {
  chatChannelTable,
  chatMessageTable,
  userTable,
} from "../../database/schema";
import createNotification from "../../notification/controllers/create-notification";
import { commentPreview } from "../../utils/comment-preview";
import { findChatAlertRecipients } from "./alert-recipients";

type MessageCreated = {
  workspaceId: string;
  channelId: string;
  messageId: string;
  userId?: string;
};

/**
 * A new message reaches the Inbox of everyone else in a direct message and of
 * each person it mentions in a channel, never for a plain channel message.
 * Only people who can read the channel and have not muted it get a row, and
 * each gets one row per message.
 */
export async function notifyChatMessage({
  workspaceId,
  channelId,
  messageId,
  userId,
}: MessageCreated) {
  const [message] = await db
    .select({
      body: chatMessageTable.body,
      channelName: chatChannelTable.name,
      isDirect: sql<boolean>`${chatChannelTable.directKey} is not null`,
      authorName: userTable.name,
    })
    .from(chatMessageTable)
    .innerJoin(chatChannelTable, eq(chatChannelTable.id, channelId))
    .leftJoin(userTable, eq(userTable.id, chatMessageTable.userId))
    .where(
      and(
        eq(chatMessageTable.id, messageId),
        eq(chatMessageTable.channelId, channelId),
        eq(chatChannelTable.workspaceId, workspaceId),
      ),
    );
  if (!message) return;

  const recipients = await findChatAlertRecipients({
    channelId,
    authorId: userId,
    body: message.body,
    isDirect: message.isDirect,
  });

  for (const recipientId of recipients)
    await createNotification({
      userId: recipientId,
      type: message.isDirect ? "chat_direct_message" : "chat_mention",
      eventData: {
        workspaceId,
        channelId,
        messageId,
        channelName: message.isDirect ? null : message.channelName,
        actorName: message.authorName ?? null,
        messagePreview: commentPreview(message.body),
      },
      resourceId: messageId,
      resourceType: "chat_message",
    });
}
