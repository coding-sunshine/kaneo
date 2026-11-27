import {
  and,
  asc,
  type Column,
  eq,
  isNull,
  like,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type db from "../../database";
import {
  activityTable,
  assetTable,
  commentTable,
  documentCommentTable,
  documentTable,
  documentVersionTable,
  taskTable,
} from "../../database/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// A loose match: a false hit keeps a file, which is the safe direction.
const links = (column: Column, assetId: string) =>
  like(column, `%/asset/${assetId}%`);

// Documents other than the purged one whose text, saved versions or
// comments link the file, in any workspace, oldest first. A link from a
// trashed document does not count.
async function linkingDocuments(tx: Tx, purgedId: string, assetId: string) {
  const inVersions = tx
    .select({ id: documentVersionTable.documentId })
    .from(documentVersionTable)
    .where(links(documentVersionTable.content, assetId));
  const inComments = tx
    .select({ id: documentCommentTable.documentId })
    .from(documentCommentTable)
    .where(links(documentCommentTable.content, assetId));
  return tx
    .select({
      id: documentTable.id,
      workspaceId: documentTable.workspaceId,
    })
    .from(documentTable)
    .where(
      and(
        ne(documentTable.id, purgedId),
        isNull(documentTable.deletedAt),
        or(
          links(documentTable.content, assetId),
          sql`${documentTable.id} in ${inVersions}`,
          sql`${documentTable.id} in ${inComments}`,
        ),
      ),
    )
    .orderBy(asc(documentTable.createdAt), asc(documentTable.id));
}

async function linkedFromTasks(tx: Tx, assetId: string) {
  const [hit] = await tx
    .select({ id: taskTable.id })
    .from(taskTable)
    .where(links(taskTable.description, assetId))
    .unionAll(
      tx
        .select({ id: commentTable.id })
        .from(commentTable)
        .where(links(commentTable.content, assetId)),
    )
    .unionAll(
      tx
        .select({ id: activityTable.id })
        .from(activityTable)
        .where(links(activityTable.content, assetId)),
    )
    .limit(1);
  return Boolean(hit);
}

/**
 * Before a document is purged, hands each of its files that another live
 * document in the same workspace still links to the oldest such document, so
 * the cascade does not take it. Files that nothing else links go with the
 * document, and the `asset_storage_cleanup` trigger queues their objects.
 *
 * A file still linked only from an issue or from another workspace has no
 * document to move to, so the purge is refused rather than breaking the link.
 */
export async function keepFilesLinkedElsewhere(
  tx: Tx,
  doc: { id: string; workspaceId: string },
) {
  const files = await tx
    .select({ id: assetTable.id })
    .from(assetTable)
    .where(eq(assetTable.documentId, doc.id));
  for (const file of files) {
    const documents = await linkingDocuments(tx, doc.id, file.id);
    const heir = documents.find((d) => d.workspaceId === doc.workspaceId);
    if (heir) {
      await tx
        .update(assetTable)
        .set({ documentId: heir.id })
        .where(eq(assetTable.id, file.id));
      continue;
    }
    if (documents.length > 0 || (await linkedFromTasks(tx, file.id))) {
      throw new HTTPException(409, {
        message:
          "A file in this document is still used elsewhere. Remove those links first.",
      });
    }
  }
}
