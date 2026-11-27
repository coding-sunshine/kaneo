import { and, desc, eq, isNotNull } from "drizzle-orm";
import { chatMessageTable } from "../../database/schema";
import { loadChannel } from "./load-channel";
import { selectMessages } from "./select-messages";

// Its own query: a pinned message can be older than the newest page.
export async function listPins(
  workspaceId: string,
  channelId: string,
  userId: string,
) {
  await loadChannel(workspaceId, channelId, userId, "read");
  return selectMessages()
    .where(
      and(
        eq(chatMessageTable.channelId, channelId),
        isNotNull(chatMessageTable.pinnedAt),
      ),
    )
    .orderBy(desc(chatMessageTable.pinnedAt));
}
