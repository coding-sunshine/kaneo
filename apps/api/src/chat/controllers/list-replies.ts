import { asc, eq } from "drizzle-orm";
import { chatMessageTable } from "../../database/schema";
import { withMentions } from "../mentions/with-mentions";
import { loadMessage } from "./load-message";
import { selectMessages, threadLink } from "./select-messages";
import { withFiles } from "./with-files";
import { withReactions } from "./with-reactions";

// ponytail: one page caps a thread's reach; page with `before` if threads grow past it.
const MAX_REPLIES = 500;

/** A message's thread replies, oldest first, for whoever can read its channel. */
export async function listReplies(
  workspaceId: string,
  channelId: string,
  messageId: string,
  userId: string,
) {
  await loadMessage(workspaceId, channelId, messageId, userId, "read");
  const replies = await selectMessages()
    .where(eq(threadLink.parentId, messageId))
    .orderBy(asc(chatMessageTable.createdAt), asc(chatMessageTable.id))
    .limit(MAX_REPLIES);
  return withMentions(
    workspaceId,
    userId,
    await withFiles(await withReactions(replies)),
  );
}
