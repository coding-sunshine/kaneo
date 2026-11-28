import { and, desc, eq, isNotNull } from "drizzle-orm";
import { chatMessageTable } from "../../database/schema";
import { withMentions } from "../mentions/with-mentions";
import { loadChannel } from "./load-channel";
import { selectMessages } from "./select-messages";
import { withFiles } from "./with-files";
import { withReactions } from "./with-reactions";

// Its own query: a pinned message can be older than the newest page.
export async function listPins(
  workspaceId: string,
  channelId: string,
  userId: string,
) {
  await loadChannel(workspaceId, channelId, userId, "read");
  const pins = await selectMessages()
    .where(
      and(
        eq(chatMessageTable.channelId, channelId),
        isNotNull(chatMessageTable.pinnedAt),
      ),
    )
    .orderBy(desc(chatMessageTable.pinnedAt));
  return withMentions(
    workspaceId,
    userId,
    await withFiles(await withReactions(pins)),
  );
}
