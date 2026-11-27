import { and, eq, exists, or } from "drizzle-orm";
import db from "../database";
import { chatChannelMemberTable, chatChannelTable } from "../database/schema";

// Who can read a channel: every workspace member for a public one, only its
// members for a private one or a direct message. Archived channels stay
// readable. Callers add the workspace filter.
export const readableChannel = (userId: string) =>
  or(
    eq(chatChannelTable.isPrivate, false),
    exists(
      db
        .select({ one: chatChannelMemberTable.userId })
        .from(chatChannelMemberTable)
        .where(
          and(
            eq(chatChannelMemberTable.channelId, chatChannelTable.id),
            eq(chatChannelMemberTable.userId, userId),
          ),
        ),
    ),
  );
