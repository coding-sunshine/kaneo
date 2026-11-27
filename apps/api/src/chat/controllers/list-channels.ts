import { and, asc, eq, isNotNull, or } from "drizzle-orm";
import {
  chatChannelMemberTable,
  chatChannelTable,
} from "../../database/schema";
import { selectChannels } from "./select-channels";

// The channel directory: every public channel plus the private ones the
// caller belongs to. The sidebar shows the joined, unarchived subset.
export async function listChannels(workspaceId: string, userId: string) {
  return selectChannels(userId)
    .where(
      and(
        eq(chatChannelTable.workspaceId, workspaceId),
        or(
          eq(chatChannelTable.isPrivate, false),
          isNotNull(chatChannelMemberTable.userId),
        ),
      ),
    )
    .orderBy(asc(chatChannelTable.name));
}
