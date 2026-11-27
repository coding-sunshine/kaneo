import { createId } from "@paralleldrive/cuid2";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import db from "../../database";
import {
  assetTable,
  documentFileTable,
  documentTable,
} from "../../database/schema";
import { extractAssetIds } from "../../storage/cleanup-assets";
import { copyToDocumentFile } from "../../storage/s3";
import { documentVisibility } from "../visibility";
import { issueFileSource } from "./issue-files";

type Database = Pick<typeof db, "select" | "insert">;

// Text taken from another document (a revision, a copy saved from a chat)
// links that document's files, and its readers may not be able to open that
// document. Each such file the author can open is copied into this document
// once, and the text points at the copy. A file the author cannot open keeps
// its link, so pasting an id never opens a file. A copy that fails keeps the
// old link too: the save matters more, and the next save tries again.
export async function copyLinkedFiles(
  database: Database,
  target: { id: string; workspaceId: string },
  userId: string,
  content: string,
) {
  const ids = [...extractAssetIds(content)];
  if (!ids.length) return content;

  const sources = await database
    .select({
      id: assetTable.id,
      objectKey: assetTable.objectKey,
      filename: assetTable.filename,
      mimeType: assetTable.mimeType,
      size: assetTable.size,
      kind: assetTable.kind,
      originalName: documentFileTable.originalName,
    })
    .from(assetTable)
    .innerJoin(documentTable, eq(documentTable.id, assetTable.documentId))
    .leftJoin(documentFileTable, eq(documentFileTable.assetId, assetTable.id))
    .where(
      and(
        inArray(assetTable.id, ids),
        eq(assetTable.workspaceId, target.workspaceId),
        ne(documentTable.id, target.id),
        isNull(documentTable.deletedAt),
        documentVisibility(userId, documentTable),
      ),
    );
  if (!sources.length) return content;

  // Copies made by an earlier save of the same text.
  const copies = new Map(
    (
      await database
        .select({
          assetId: documentFileTable.assetId,
          sourceUrl: documentFileTable.sourceUrl,
        })
        .from(documentFileTable)
        .where(
          and(
            eq(documentFileTable.documentId, target.id),
            inArray(
              documentFileTable.sourceUrl,
              sources.map((source) => issueFileSource(source.id)),
            ),
          ),
        )
    ).map((copy) => [copy.sourceUrl, copy.assetId]),
  );

  let copied = content;
  for (const source of sources) {
    let copyId = copies.get(issueFileSource(source.id));
    if (!copyId) {
      try {
        copyId = await copyFile(database, target, userId, source);
      } catch (error) {
        console.error("Failed to copy a linked document file:", error);
        continue;
      }
    }
    copied = copied.replaceAll(
      `/api/asset/${source.id}`,
      `/api/asset/${copyId}`,
    );
  }
  return copied;
}

async function copyFile(
  database: Database,
  target: { id: string; workspaceId: string },
  userId: string,
  source: {
    id: string;
    objectKey: string;
    filename: string;
    mimeType: string;
    size: number;
    kind: string;
    originalName: string | null;
  },
) {
  const objectKey = await copyToDocumentFile({
    sourceKey: source.objectKey,
    workspaceId: target.workspaceId,
    documentId: target.id,
    filename: source.filename,
    contentType: source.mimeType,
  });
  const id = createId();
  await database.insert(assetTable).values({
    id,
    workspaceId: target.workspaceId,
    documentId: target.id,
    objectKey,
    filename: source.filename,
    mimeType: source.mimeType,
    size: source.size,
    kind: source.kind,
    surface: "document",
    createdBy: userId,
  });
  await database.insert(documentFileTable).values({
    assetId: id,
    documentId: target.id,
    originalName: source.originalName ?? source.filename,
    sourceUserId: userId,
    sourceUrl: issueFileSource(source.id),
  });
  return id;
}
