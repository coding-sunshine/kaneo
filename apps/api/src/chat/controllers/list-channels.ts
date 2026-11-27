import { and, asc, eq, isNotNull, isNull, or } from "drizzle-orm";
import {
  chatChannelMemberTable,
  chatChannelTable,
} from "../../database/schema";
import { countUnread } from "./count-unread";
import { selectChannels } from "./select-channels";

// The channel directory: every public channel plus the private ones the
// caller belongs to. The sidebar shows the joined, unarchived subset. Direct
// messages have their own list.
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

const listVisibleChannels = (workspaceId: string, userId: string) =>
  selectChannels(userId)
    .where(
      and(
        eq(chatChannelTable.workspaceId, workspaceId),
        isNull(chatChannelTable.directKey),
        or(
          eq(chatChannelTable.isPrivate, false),
          isNotNull(chatChannelMemberTable.userId),
        ),
      ),
    )
    .orderBy(asc(chatChannelTable.name));
