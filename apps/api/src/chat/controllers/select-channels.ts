import { and, eq, sql } from "drizzle-orm";
import db from "../../database";
import {
  chatChannelMemberTable,
  chatChannelTable,
} from "../../database/schema";

// Channels with the caller's membership attached; callers add the filters.
export const selectChannels = (userId: string) =>
  db
    .select({
      id: chatChannelTable.id,
      workspaceId: chatChannelTable.workspaceId,
      name: chatChannelTable.name,
      topic: chatChannelTable.topic,
      isPrivate: chatChannelTable.isPrivate,
      isDirect: sql<boolean>`${chatChannelTable.directKey} is not null`,
      isMember: sql<boolean>`${chatChannelMemberTable.userId} is not null`,
      archivedAt: chatChannelTable.archivedAt,
      createdAt: chatChannelTable.createdAt,
    })
    .from(chatChannelTable)
    .leftJoin(
      chatChannelMemberTable,
      and(
        eq(chatChannelMemberTable.channelId, chatChannelTable.id),
        eq(chatChannelMemberTable.userId, userId),
      ),
    );
