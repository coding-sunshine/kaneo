import { asc, eq } from "drizzle-orm";
import { chatMessageTable } from "../../database/schema";
import { parseMentionIds } from "../../utils/parse-mentions";
import { findThreadRoot } from "../../chat/controllers/find-thread-root";
import { loadMessage } from "../../chat/controllers/load-message";
import {
  selectMessages,
  threadLink,
} from "../../chat/controllers/select-messages";

const MAX_MESSAGES = 100;

// A mention tag reads as the name it shows.
const plain = (body: string) =>
  body.replace(/<kaneo-mention[^>]*>(.*?)<\/kaneo-mention>/gi, "$1");

/**
 * The whole thread a message is in, for a person who can read its channel:
 * its first message, then the replies, oldest first, with the people the
 * thread mentions. A channel they cannot read answers 404.
 */
export async function readThread(
  workspaceId: string,
  channelId: string,
  messageId: string,
  userId: string,
) {
  await loadMessage(workspaceId, channelId, messageId, userId, "read");
  const rootId = await findThreadRoot(channelId, messageId);
  const [root] = await selectMessages().where(eq(chatMessageTable.id, rootId));
  const replies = await selectMessages()
    .where(eq(threadLink.parentId, rootId))
    .orderBy(asc(chatMessageTable.createdAt), asc(chatMessageTable.id))
    .limit(MAX_MESSAGES - 1);
  const messages = [...(root ? [root] : []), ...replies];
  return {
    rootId,
    mentionedIds: [
      ...new Set(messages.flatMap((message) => parseMentionIds(message.body))),
    ],
    transcript: messages
      .map(
        (message) =>
          `${message.authorName ?? "Someone"}: ${plain(message.body)}`,
      )
      .join("\n"),
  };
}
