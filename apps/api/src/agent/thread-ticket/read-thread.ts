import { desc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { chatMessageTable } from "../../database/schema";
import { parseMentionIds } from "../../utils/parse-mentions";
import { findThreadRoot } from "../../chat/controllers/find-thread-root";
import { loadChannel } from "../../chat/controllers/load-channel";
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
 * The thread a message is in, for a person who can read its channel: its
 * first message, then its newest replies, oldest first, with the people the
 * thread mentions. A long thread loses its oldest replies, never the latest. A channel they cannot read answers 404; one its members
 * marked no AI answers 403 before anything reaches the model.
 */
export async function readThread(
  workspaceId: string,
  channelId: string,
  messageId: string,
  userId: string,
) {
  await loadMessage(workspaceId, channelId, messageId, userId, "read");
  const channel = await loadChannel(workspaceId, channelId, userId, "read");
  if (channel.aiDisabled)
    throw new HTTPException(403, {
      message: "AI is turned off in this channel",
    });
  const rootId = await findThreadRoot(channelId, messageId);
  const [root] = await selectMessages().where(eq(chatMessageTable.id, rootId));
  const newest = await selectMessages()
    .where(eq(threadLink.parentId, rootId))
    .orderBy(desc(chatMessageTable.createdAt), desc(chatMessageTable.id))
    .limit(MAX_MESSAGES - 1);
  const messages = [...(root ? [root] : []), ...newest.reverse()];
  return {
    rootId,
    messages: messages.map(({ id, userId: authorId, authorName }) => ({
      id,
      userId: authorId,
      authorName,
    })),
    bodies: new Map(
      messages.map((message) => [message.id, plain(message.body)]),
    ),
    mentionedIds: [
      ...new Set(messages.flatMap((message) => parseMentionIds(message.body))),
    ],
    transcript: messages
      .map(
        (message) =>
          `[${message.id}] ${message.authorName ?? "Someone"}: ${plain(message.body)}`,
      )
      .join("\n"),
  };
}
