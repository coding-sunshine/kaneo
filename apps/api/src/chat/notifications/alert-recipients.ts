import { and, eq, inArray } from "drizzle-orm";
import db from "../../database";
import { chatChannelMuteTable } from "../../database/schema";
import { parseMentionIds } from "../../utils/parse-mentions";
import { findChannelReaders } from "../../ws/chat-channel-readers";
import { findUnreadRecipients } from "../../ws/chat-unread-recipients";

/**
 * Who a new message alerts: everyone else in a direct message, or each person
 * it mentions in a channel, never anyone for a plain channel message. Only
 * people who can read the channel and have not muted it count.
 */
export async function findChatAlertRecipients(message: {
  channelId: string;
  authorId: string | undefined;
  body: string;
  isDirect: boolean;
}) {
  const { channelId, authorId } = message;
  const candidates = message.isDirect
    ? await findUnreadRecipients(channelId, authorId)
    : parseMentionIds(message.body).filter((id) => id !== authorId);
  if (candidates.length === 0) return [];

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
  return access ? unmuted.filter((id) => access.readers.has(id)) : [];
}
