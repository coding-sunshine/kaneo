import { and, eq, isNotNull } from "drizzle-orm";
import db, { schema } from "../../database";
import { chatMessageFileTable } from "../../database/schema";
import type { DbOrTx } from "../../project-access/db-or-tx";

/** Storage objects (uploads, chat files, project backgrounds and custom emoji) owned by a workspace. */
export async function listWorkspaceObjectKeys(
  workspaceId: string,
  database: DbOrTx = db,
) {
  // Sequential: a transaction's connection runs one query at a time.
  const assets = await database
    .select({ objectKey: schema.assetTable.objectKey })
    .from(schema.assetTable)
    .where(eq(schema.assetTable.workspaceId, workspaceId));
  const backgrounds = await database
    .select({ objectKey: schema.projectTable.backgroundObjectKey })
    .from(schema.projectTable)
    .where(
      and(
        eq(schema.projectTable.workspaceId, workspaceId),
        isNotNull(schema.projectTable.backgroundObjectKey),
      ),
    );
  const emoji = await database
    .select({ objectKey: schema.workspaceEmojiTable.objectKey })
    .from(schema.workspaceEmojiTable)
    .where(eq(schema.workspaceEmojiTable.workspaceId, workspaceId));
  const chatFiles = await database
    .select({ objectKey: chatMessageFileTable.objectKey })
    .from(chatMessageFileTable)
    .where(eq(chatMessageFileTable.workspaceId, workspaceId));
  return [...assets, ...backgrounds, ...emoji, ...chatFiles].flatMap((row) =>
    row.objectKey ? [row.objectKey] : [],
  );
}
