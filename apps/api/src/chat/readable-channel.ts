import { and, eq, exists, isNull, or } from "drizzle-orm";
import db from "../database";
import { chatChannelMemberTable, chatChannelTable } from "../database/schema";
import { directMessageOpenToGuest } from "../guest/direct-message-open-to-guest";

// Who can read a channel: every workspace member for a public one, only its
// members for a private one or a direct message. A guest reads only the
// channels they joined, and a direct message only while they still work with
// everyone in it, as loadChannel decides. Archived channels stay readable.
// Callers add the workspace filter.
export const readableChannel = (
  userId: string,
  workspaceId: string,
  guest: boolean,
) => {
  const joined = exists(
    db
      .select({ one: chatChannelMemberTable.userId })
      .from(chatChannelMemberTable)
      .where(
        and(
          eq(chatChannelMemberTable.channelId, chatChannelTable.id),
          eq(chatChannelMemberTable.userId, userId),
        ),
      ),
  );
  if (!guest) return or(eq(chatChannelTable.isPrivate, false), joined);
  return and(
    joined,
    or(
      isNull(chatChannelTable.directKey),
      directMessageOpenToGuest(userId, chatChannelTable.id, workspaceId),
    ),
  );
};
