import { and, asc, eq, isNotNull, or } from "drizzle-orm";
import {
  chatChannelMemberTable,
  chatChannelTable,
} from "../../database/schema";
import { isWorkspaceGuest } from "../../guest/is-workspace-guest";
import { selectChannels } from "./select-channels";

// The channel directory: every public channel plus the private ones the
// caller belongs to. A guest gets only the channels they were added to. The
// sidebar shows the joined, unarchived subset.
export async function listChannels(workspaceId: string, userId: string) {
  const joined = isNotNull(chatChannelMemberTable.userId);
  const visible = (await isWorkspaceGuest(workspaceId, userId))
    ? joined
    : or(eq(chatChannelTable.isPrivate, false), joined);
  return selectChannels(userId)
    .where(and(eq(chatChannelTable.workspaceId, workspaceId), visible))
    .orderBy(asc(chatChannelTable.name));
}
