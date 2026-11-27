import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import db from "../../database";
import {
  chatChannelMemberTable,
  chatChannelTable,
} from "../../database/schema";
import { selectChannels } from "./select-channels";

// The caller's direct messages, newest first, each with its member ids so the
// sidebar can name it.
export async function listDirectMessages(workspaceId: string, userId: string) {
  const channels = await selectChannels(userId)
    .where(
      and(
        eq(chatChannelTable.workspaceId, workspaceId),
        isNotNull(chatChannelTable.directKey),
        isNotNull(chatChannelMemberTable.userId),
      ),
    )
    .orderBy(desc(chatChannelTable.createdAt));
  if (channels.length === 0) return [];
  const members = await db
    .select({
      channelId: chatChannelMemberTable.channelId,
      userId: chatChannelMemberTable.userId,
    })
    .from(chatChannelMemberTable)
    .where(
      inArray(
        chatChannelMemberTable.channelId,
        channels.map((channel) => channel.id),
      ),
    )
    .orderBy(asc(chatChannelMemberTable.joinedAt));
  return channels.map((channel) => ({
    ...channel,
    memberIds: members
      .filter((member) => member.channelId === channel.id)
      .map((member) => member.userId),
  }));
}
