import { and, asc, eq, isNull } from "drizzle-orm";
import { chatChannelTable } from "../../database/schema";
import { readableChannel } from "../readable-channel";
import { selectChannels } from "./select-channels";

// The channel directory: every public channel plus the private ones the
// caller belongs to. The sidebar shows the joined, unarchived subset. Direct
// messages have their own list.
export async function listChannels(workspaceId: string, userId: string) {
  return selectChannels(userId)
    .where(
      and(
        eq(chatChannelTable.workspaceId, workspaceId),
        isNull(chatChannelTable.directKey),
        readableChannel(userId),
      ),
    )
    .orderBy(asc(chatChannelTable.name));
}
