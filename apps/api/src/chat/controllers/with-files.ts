import { asc, inArray } from "drizzle-orm";
import db from "../../database";
import { chatMessageFileTable } from "../../database/schema";

/** Attaches every message's files with one query for the whole page. */
export async function withFiles<T extends { id: string }>(messages: T[]) {
  const ids = messages.map((message) => message.id);
  const files = ids.length
    ? await db
        .select({
          messageId: chatMessageFileTable.messageId,
          id: chatMessageFileTable.id,
          filename: chatMessageFileTable.filename,
          mimeType: chatMessageFileTable.mimeType,
          size: chatMessageFileTable.size,
        })
        .from(chatMessageFileTable)
        .where(inArray(chatMessageFileTable.messageId, ids))
        .orderBy(
          asc(chatMessageFileTable.createdAt),
          asc(chatMessageFileTable.id),
        )
    : [];
  return messages.map((message) => ({
    ...message,
    files: files.flatMap(({ messageId, ...file }) =>
      messageId === message.id ? [file] : [],
    ),
  }));
}
