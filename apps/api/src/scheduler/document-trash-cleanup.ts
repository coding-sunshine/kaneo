import { and, asc, inArray, isNotNull, lt, ne } from "drizzle-orm";
import db from "../database";
import { documentTable } from "../database/schema";

const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Permanently deletes documents that have been in the trash past the retention
 * window. Cascading deletes remove their `asset` rows and the
 * `asset_storage_cleanup` trigger queues every stored object key.
 */
export async function purgeTrashedDocuments(
  retentionMs = TRASH_RETENTION_MS,
): Promise<void> {
  const cutoff = new Date(Date.now() - retentionMs);
  const deadline = Date.now() + 60_000;
  do {
    const count = await db.transaction(async (tx) => {
      const batch = await tx
        .select({ id: documentTable.id })
        .from(documentTable)
        .where(
          and(
            isNotNull(documentTable.deletedAt),
            lt(documentTable.deletedAt, cutoff),
            ne(documentTable.status, "current"),
          ),
        )
        .orderBy(asc(documentTable.deletedAt), asc(documentTable.id))
        .limit(500)
        .for("update", { skipLocked: true });
      if (!batch.length) return 0;
      await tx.delete(documentTable).where(
        inArray(
          documentTable.id,
          batch.map((doc) => doc.id),
        ),
      );
      return batch.length;
    });
    if (count < 500) break;
  } while (Date.now() < deadline);
}
