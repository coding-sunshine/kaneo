import { and, asc, eq, isNotNull, isNull, or } from "drizzle-orm";
import {
  chatChannelMemberTable,
  chatChannelTable,
} from "../../database/schema";
import { isWorkspaceGuest } from "../../guest/is-workspace-guest";
import { countUnread } from "./count-unread";
import { selectChannels } from "./select-channels";

// The channel directory: every public channel plus the private ones the
// caller belongs to. A guest gets only the channels they were added to. The
// sidebar shows the joined, unarchived subset. Direct messages have their own
// list.
export async function listChannels(workspaceId: string, userId: string) {
  const [channels, unread] = await Promise.all([
    listVisibleChannels(workspaceId, userId),
    countUnread(workspaceId, userId),
  ]);
  return channels.map((channel) => ({
    ...channel,
    unreadCount: unread.get(channel.id) ?? 0,
  }));
}

async function listVisibleChannels(workspaceId: string, userId: string) {
  const joined = isNotNull(chatChannelMemberTable.userId);
  const visible = (await isWorkspaceGuest(workspaceId, userId))
    ? joined
    : or(eq(chatChannelTable.isPrivate, false), joined);
  return selectChannels(userId)
    .where(
      and(
        eq(chatChannelTable.workspaceId, workspaceId),
        isNull(chatChannelTable.directKey),
        visible,
      ),
    )
    .orderBy(asc(chatChannelTable.name));
}
