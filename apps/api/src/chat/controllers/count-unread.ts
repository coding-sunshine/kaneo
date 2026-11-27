import { and, count, eq, gt, ne, or, isNull } from "drizzle-orm";
import db from "../../database";
import {
  chatChannelMemberTable,
  chatChannelTable,
  chatMessageTable,
} from "../../database/schema";

/**
 * Messages from others since the caller last read each channel they joined,
 * in one aggregate. Channels with nothing new are left out.
 */
export async function countUnread(workspaceId: string, userId: string) {
  const rows = await db
    .select({ channelId: chatMessageTable.channelId, total: count() })
    .from(chatMessageTable)
    .innerJoin(
      chatChannelMemberTable,
      and(
        eq(chatChannelMemberTable.channelId, chatMessageTable.channelId),
        eq(chatChannelMemberTable.userId, userId),
      ),
    )
    .innerJoin(
      chatChannelTable,
      eq(chatChannelTable.id, chatMessageTable.channelId),
    )
    .where(
      and(
        eq(chatChannelTable.workspaceId, workspaceId),
        gt(chatMessageTable.createdAt, chatChannelMemberTable.lastReadAt),
        or(
          isNull(chatMessageTable.userId),
          ne(chatMessageTable.userId, userId),
        ),
      ),
    )
    .groupBy(chatMessageTable.channelId);
  return new Map(rows.map((row) => [row.channelId, row.total]));
}
