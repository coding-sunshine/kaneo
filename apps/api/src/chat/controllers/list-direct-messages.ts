import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import db from "../../database";
import {
  chatChannelMemberTable,
  chatChannelTable,
} from "../../database/schema";
import { countUnread } from "./count-unread";
import { directMessageOpenToGuest } from "../../guest/direct-message-open-to-guest";
import { isWorkspaceGuest } from "../../guest/is-workspace-guest";
import { selectChannels } from "./select-channels";

// The caller's direct messages, newest first, each with its member ids so the
// sidebar can name it. A guest gets only those with people they work with.
export async function listDirectMessages(workspaceId: string, userId: string) {
  const guest = await isWorkspaceGuest(workspaceId, userId);
  const channels = await selectChannels(userId)
    .where(
      and(
        eq(chatChannelTable.workspaceId, workspaceId),
        isNotNull(chatChannelTable.directKey),
        isNotNull(chatChannelMemberTable.userId),
        guest
          ? directMessageOpenToGuest(userId, chatChannelTable.id, workspaceId)
          : undefined,
      ),
    )
    .orderBy(desc(chatChannelTable.createdAt));
  if (channels.length === 0) return [];
  const unread = await countUnread(workspaceId, userId);
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
    // Members of one conversation join at the same instant; the id keeps
    // their order stable.
    .orderBy(
      asc(chatChannelMemberTable.joinedAt),
      asc(chatChannelMemberTable.userId),
    );
  return channels.map((channel) => ({
    ...channel,
    memberIds: members
      .filter((member) => member.channelId === channel.id)
      .map((member) => member.userId),
    unreadCount: unread.get(channel.id) ?? 0,
  }));
}
