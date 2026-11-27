import { asc, inArray } from "drizzle-orm";
import db from "../../database";
import { chatMessageReactionTable } from "../../database/schema";
import { groupReactions } from "../../activity/group-reactions";

/** Attaches every message's reactions with one query for the whole page. */
export async function withReactions<T extends { id: string }>(messages: T[]) {
  const ids = messages.map((message) => message.id);
  const reactionsFor = groupReactions(
    ids.length
      ? await db
          .select({
            activityId: chatMessageReactionTable.messageId,
            userId: chatMessageReactionTable.userId,
            emoji: chatMessageReactionTable.emoji,
          })
          .from(chatMessageReactionTable)
          .where(inArray(chatMessageReactionTable.messageId, ids))
          .orderBy(asc(chatMessageReactionTable.createdAt))
      : [],
  );
  return messages.map((message) => ({
    ...message,
    reactions: reactionsFor(message.id),
  }));
}
