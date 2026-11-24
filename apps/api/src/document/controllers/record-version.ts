import { desc, eq, sql } from "drizzle-orm";
import db from "../../database";
import { documentVersionTable } from "../../database/schema";

// One author's edits within this window fold into one history entry, so
// autosave does not write a version per keystroke batch.
const FOLD_MS = 10 * 60 * 1000;

// Returns the id of the history row that now holds the snapshot.
export async function recordVersion(
  documentId: string,
  authorId: string,
  snapshot: { title: string; content: string },
  options: {
    fold?: boolean;
    database?: Pick<typeof db, "select" | "insert" | "update">;
  } = {},
) {
  const database = options.database ?? db;
  const now = new Date();
  const [latest] = await database
    .select({
      id: documentVersionTable.id,
      authorId: documentVersionTable.authorId,
      updatedAt: documentVersionTable.updatedAt,
      // The text an approval pinned. A later edit never overwrites it. The
      // column is spelled out: Drizzle drops the table from a column in a
      // one-table selection, and a bare "id" would be the document's.
      approved: sql<boolean>`EXISTS (
        SELECT 1 FROM document AS approved_document
        WHERE approved_document.approved_version_id = document_version.id
      )`,
    })
    .from(documentVersionTable)
    .where(eq(documentVersionTable.documentId, documentId))
    .orderBy(desc(documentVersionTable.createdAt))
    .limit(1);

  if (
    options.fold !== false &&
    latest &&
    !latest.approved &&
    latest.authorId === authorId &&
    now.getTime() - latest.updatedAt.getTime() < FOLD_MS
  ) {
    await database
      .update(documentVersionTable)
      .set({ ...snapshot, updatedAt: now })
      .where(eq(documentVersionTable.id, latest.id));
    return latest.id;
  }

  const [written] = await database
    .insert(documentVersionTable)
    .values({
      documentId,
      authorId,
      ...snapshot,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: documentVersionTable.id });
  if (!written) throw new Error("Version insert returned no row");
  return written.id;
}
