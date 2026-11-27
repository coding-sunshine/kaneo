import { eq } from "drizzle-orm";
import db from "../database";
import { chatChannelMemberTable } from "../database/schema";
import { findChannelReaders } from "./chat-channel-readers";

/**
 * Members of the channel, other than the author, who may still read it: the
 * ones whose unread count a new message changes.
 */
export async function findUnreadRecipients(
  channelId: string,
  authorId: string | undefined,
) {
  const members = await db
    .select({ userId: chatChannelMemberTable.userId })
    .from(chatChannelMemberTable)
    .where(eq(chatChannelMemberTable.channelId, channelId));
  const others = members
    .map((member) => member.userId)
    .filter((id) => id !== authorId);
  if (others.length === 0) return [];
  const access = await findChannelReaders(channelId, others);
  return access ? others.filter((id) => access.readers.has(id)) : [];
}
