import { and, eq } from "drizzle-orm";
import db from "../../database";
import { chatMessageReactionTable } from "../../database/schema";
import { assertCustomEmojiExists } from "../../emoji/assert-custom-emoji";
import { publishEvent } from "../../events";
import { loadMessage } from "./load-message";

/** Adds or removes the caller's reaction; both are idempotent. */
export async function reactToMessage(
  workspaceId: string,
  channelId: string,
  messageId: string,
  userId: string,
  emoji: string,
  reacted: boolean,
) {
  await loadMessage(workspaceId, channelId, messageId, userId, "post");
  // Removing stays allowed after the emoji is deleted from the workspace.
  if (reacted) {
    await assertCustomEmojiExists(workspaceId, emoji);
    await db
      .insert(chatMessageReactionTable)
      .values({ messageId, userId, emoji })
      .onConflictDoNothing();
  } else
    await db
      .delete(chatMessageReactionTable)
      .where(
        and(
          eq(chatMessageReactionTable.messageId, messageId),
          eq(chatMessageReactionTable.userId, userId),
          eq(chatMessageReactionTable.emoji, emoji),
        ),
      );
  await publishEvent("chat.message_updated", {
    workspaceId,
    channelId,
    messageId,
  });
  return loadMessage(workspaceId, channelId, messageId, userId, "read");
}
