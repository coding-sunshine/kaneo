import { and, desc, eq } from "drizzle-orm";
import db from "../../database";
import { workspaceEmojiTable } from "../../database/schema";
import { normalizeApiServerUrl } from "../../utils/openapi-spec";

export function emojiUrl(
  requestUrl: string,
  emoji: { workspaceId: string; id: string; version: string },
) {
  const base = normalizeApiServerUrl(
    process.env.KANEO_API_URL || new URL(requestUrl).origin,
  );
  return `${base}/emoji/workspace/${emoji.workspaceId}/${emoji.id}/image?v=${encodeURIComponent(emoji.version)}`;
}

/** Newest first, like Linear's Custom section. */
export async function listEmoji(workspaceId: string, requestUrl: string) {
  const rows = await db
    .select()
    .from(workspaceEmojiTable)
    .where(eq(workspaceEmojiTable.workspaceId, workspaceId))
    .orderBy(desc(workspaceEmojiTable.createdAt), desc(workspaceEmojiTable.id));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    url: emojiUrl(requestUrl, row),
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  }));
}

export async function findEmoji(workspaceId: string, emojiId: string) {
  const [row] = await db
    .select()
    .from(workspaceEmojiTable)
    .where(
      and(
        eq(workspaceEmojiTable.workspaceId, workspaceId),
        eq(workspaceEmojiTable.id, emojiId),
      ),
    )
    .limit(1);
  return row;
}

export async function emojiNameTaken(workspaceId: string, name: string) {
  const [row] = await db
    .select({ id: workspaceEmojiTable.id })
    .from(workspaceEmojiTable)
    .where(
      and(
        eq(workspaceEmojiTable.workspaceId, workspaceId),
        eq(workspaceEmojiTable.name, name),
      ),
    )
    .limit(1);
  return Boolean(row);
}
