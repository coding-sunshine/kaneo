import { and, eq, inArray, like } from "drizzle-orm";
import db from "../../database";
import { assetTable, documentCommentTable } from "../../database/schema";

const DOCUMENT_ASSET_URL_PATTERN = /(?:\/api)?\/asset\/([a-z0-9]+)/gi;

export function extractDocumentAssetIds(
  content: string | null | undefined,
): Set<string> {
  const ids = new Set<string>();
  if (!content) return ids;

  DOCUMENT_ASSET_URL_PATTERN.lastIndex = 0;
  for (
    let match = DOCUMENT_ASSET_URL_PATTERN.exec(content);
    match !== null;
    match = DOCUMENT_ASSET_URL_PATTERN.exec(content)
  ) {
    if (match[1]) ids.add(match[1]);
  }
  return ids;
}

async function isReferencedInDocumentComments(
  documentId: string,
  assetId: string,
): Promise<boolean> {
  const comments = await db
    .select({ content: documentCommentTable.content })
    .from(documentCommentTable)
    .where(
      and(
        eq(documentCommentTable.documentId, documentId),
        like(documentCommentTable.content, `%/asset/${assetId}%`),
      ),
    );
  return comments.some((comment) =>
    extractDocumentAssetIds(comment.content).has(assetId),
  );
}

/**
 * Removes asset rows owned by this document that were unlinked from its text
 * and are not referenced in its comments. Deleting from `asset` fires the
 * `asset_storage_cleanup` trigger, queuing each object key in `storage_cleanup`.
 */
export async function cleanupUnlinkedDocumentFiles(
  documentId: string,
  oldContent: string | null | undefined,
  newContent: string | null | undefined,
): Promise<void> {
  const oldIds = extractDocumentAssetIds(oldContent);
  const newIds = extractDocumentAssetIds(newContent);
  const removedIds = [...oldIds].filter((id) => !newIds.has(id));
  if (removedIds.length === 0) return;

  const owned = await db
    .select({ id: assetTable.id })
    .from(assetTable)
    .where(
      and(
        inArray(assetTable.id, removedIds),
        eq(assetTable.documentId, documentId),
      ),
    );
  if (owned.length === 0) return;

  const toDelete: string[] = [];
  for (const asset of owned) {
    if (!(await isReferencedInDocumentComments(documentId, asset.id))) {
      toDelete.push(asset.id);
    }
  }
  if (toDelete.length === 0) return;

  await db
    .delete(assetTable)
    .where(
      and(
        inArray(assetTable.id, toDelete),
        eq(assetTable.documentId, documentId),
      ),
    );
}
