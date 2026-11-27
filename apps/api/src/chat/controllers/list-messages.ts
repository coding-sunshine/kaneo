import { and, desc, eq, lt } from "drizzle-orm";
import { chatMessageTable } from "../../database/schema";
import { loadChannel } from "./load-channel";
import { selectMessages } from "./select-messages";
import { withReactions } from "./with-reactions";

const PAGE_SIZE = 50;

// The newest page, oldest first; pass `before` to page back through history.
export async function listMessages(
  workspaceId: string,
  channelId: string,
  userId: string,
  before?: string,
) {
  await loadChannel(workspaceId, channelId, userId, "read");
  const rows = await selectMessages()
    .where(
      and(
        eq(chatMessageTable.channelId, channelId),
        before ? lt(chatMessageTable.createdAt, new Date(before)) : undefined,
      ),
    )
    .orderBy(desc(chatMessageTable.createdAt), desc(chatMessageTable.id))
    .limit(PAGE_SIZE);
  return withReactions(rows.reverse());
}
