import { desc, eq } from "drizzle-orm";
import db from "../../database";
import { documentVersionTable } from "../../database/schema";

// One author's edits within this window fold into one history entry, so
// autosave does not write a version per keystroke batch.
const FOLD_MS = 10 * 60 * 1000;

export async function recordVersion(
  documentId: string,
  authorId: string,
  snapshot: { title: string; content: string },
  options: { fold?: boolean } = {},
) {
  const now = new Date();
  const [latest] = await db
    .select({
      id: documentVersionTable.id,
      authorId: documentVersionTable.authorId,
      updatedAt: documentVersionTable.updatedAt,
    })
    .from(documentVersionTable)
    .where(eq(documentVersionTable.documentId, documentId))
    .orderBy(desc(documentVersionTable.createdAt))
    .limit(1);

  if (
    options.fold !== false &&
    latest &&
    latest.authorId === authorId &&
    now.getTime() - latest.updatedAt.getTime() < FOLD_MS
  ) {
    await db
      .update(documentVersionTable)
      .set({ ...snapshot, updatedAt: now })
      .where(eq(documentVersionTable.id, latest.id));
    return;
  }

  await db.insert(documentVersionTable).values({
    documentId,
    authorId,
    ...snapshot,
    createdAt: now,
    updatedAt: now,
  });
}
