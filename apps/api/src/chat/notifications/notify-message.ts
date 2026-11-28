import { and, eq, inArray, sql } from "drizzle-orm";
import db from "../../database";
import {
  chatChannelMuteTable,
  chatChannelTable,
  chatMessageTable,
  userTable,
} from "../../database/schema";
import createNotification from "../../notification/controllers/create-notification";
import { commentPreview } from "../../utils/comment-preview";
import { parseMentionIds } from "../../utils/parse-mentions";
import { findChannelReaders } from "../../ws/chat-channel-readers";
import { findUnreadRecipients } from "../../ws/chat-unread-recipients";

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

  const candidates = message.isDirect
    ? await findUnreadRecipients(channelId, userId)
    : parseMentionIds(message.body).filter((id) => id !== userId);
  if (candidates.length === 0) return;

  const muted = new Set(
    (
      await db
        .select({ userId: chatChannelMuteTable.userId })
        .from(chatChannelMuteTable)
        .where(
          and(
            eq(chatChannelMuteTable.channelId, channelId),
            inArray(chatChannelMuteTable.userId, candidates),
          ),
        )
    ).map((row) => row.userId),
  );
  const unmuted = candidates.filter((id) => !muted.has(id));
  const access = unmuted.length
    ? await findChannelReaders(channelId, unmuted)
    : null;
  if (!access) return;

  for (const recipientId of unmuted.filter((id) => access.readers.has(id)))
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
