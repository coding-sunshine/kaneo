import { eq } from "drizzle-orm";
import type db from "../../database";
import { chatMessageReferenceTable } from "../../database/schema";
import { findTargets } from "../../reference/sync-references";

type Database = Pick<typeof db, "select" | "insert" | "delete">;

/** Makes the tickets, documents and teams a message names match its text. */
export async function syncMessageReferences(
  database: Database,
  workspaceId: string,
  messageId: string,
  body: string,
) {
  const targets = await findTargets(database, workspaceId, null, body);
  await database
    .delete(chatMessageReferenceTable)
    .where(eq(chatMessageReferenceTable.messageId, messageId));
  if (!targets.length) return;
  await database.insert(chatMessageReferenceTable).values(
    targets.map((target) => ({
      workspaceId,
      messageId,
      ...("targetTaskId" in target
        ? { targetKind: "task" as const, targetId: target.targetTaskId }
        : "targetDocumentId" in target
          ? {
              targetKind: "document" as const,
              targetId: target.targetDocumentId,
            }
          : {
              targetKind: "project" as const,
              targetId: target.targetProjectId,
            }),
    })),
  );
}
