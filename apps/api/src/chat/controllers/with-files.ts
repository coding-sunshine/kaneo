import { asc, inArray } from "drizzle-orm";
import db from "../../database";
import { assetTable } from "../../database/schema";

/** Attaches every message's files with one query for the whole page. */
export async function withFiles<T extends { id: string }>(messages: T[]) {
  const ids = messages.map((message) => message.id);
  const files = ids.length
    ? await db
        .select({
          messageId: assetTable.chatMessageId,
          id: assetTable.id,
          filename: assetTable.filename,
          mimeType: assetTable.mimeType,
          size: assetTable.size,
        })
        .from(assetTable)
        .where(inArray(assetTable.chatMessageId, ids))
        .orderBy(asc(assetTable.createdAt), asc(assetTable.id))
    : [];
  return messages.map((message) => ({
    ...message,
    files: files.flatMap(({ messageId, ...file }) =>
      messageId === message.id ? [file] : [],
    ),
  }));
}
