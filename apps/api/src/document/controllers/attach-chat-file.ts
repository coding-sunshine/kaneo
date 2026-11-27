import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import db from "../../database";
import { assetTable, documentFileTable } from "../../database/schema";
import { queueStorageCleanup } from "../../storage/cleanup-queue";
import {
  assertStorageConfigured,
  isImageContentType,
  putDocumentFile,
  validateTaskAssetUploadInput,
} from "../../storage/s3";
import { documentFileContentType, fileTypeRefused } from "../file-types";
import { type chatFileBody, MAX_CHAT_FILE_BYTES } from "../schema";
import { assertNotSuperseded } from "./assert-not-superseded";
import { documentFileLine } from "./file-line";
import { loadDocument } from "./load-document";
import { writeDocument } from "./update-document";

const BASE64 =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const notConfigured = "File uploads are not configured on this instance.";

function decode(contentBase64: string) {
  // Buffer.from skips what is not base64, so a broken text would be stored
  // as a shorter file.
  if (!BASE64.test(contentBase64)) {
    throw new HTTPException(400, { message: "The file is not valid base64." });
  }
  const bytes = Buffer.from(contentBase64, "base64");
  if (bytes.byteLength > MAX_CHAT_FILE_BYTES) {
    throw new HTTPException(400, {
      message: `A file sent from a chat can be at most ${MAX_CHAT_FILE_BYTES.toLocaleString("en-US")} bytes.`,
    });
  }
  return bytes;
}

/**
 * Stores a file an assistant sends from a chat as one of the document's files,
 * and adds a link to it at the end of the text. The same people may do it as
 * may edit the text.
 */
export async function attachChatFile(
  workspaceId: string,
  id: string,
  userId: string,
  body: z.infer<typeof chatFileBody>,
  apiBaseUrl: string,
) {
  const doc = await loadDocument(workspaceId, id, userId, { need: "edit" });
  assertNotSuperseded(doc);
  const contentType = documentFileContentType(body.filename);
  if (!contentType) {
    throw new HTTPException(415, { message: fileTypeRefused });
  }
  const bytes = decode(body.contentBase64);
  try {
    validateTaskAssetUploadInput(contentType, bytes.byteLength);
  } catch (error) {
    throw new HTTPException(400, {
      message: error instanceof Error ? error.message : "Invalid file",
    });
  }
  try {
    assertStorageConfigured();
  } catch (error) {
    console.warn(
      `A file from an assistant chat was refused: ${error instanceof Error ? error.message : notConfigured}`,
    );
    throw new HTTPException(503, { message: notConfigured });
  }

  let key: string;
  try {
    key = await putDocumentFile({
      workspaceId,
      documentId: id,
      filename: body.filename,
      contentType,
      body: bytes,
    });
  } catch {
    throw new HTTPException(503, { message: "The file could not be stored." });
  }

  const kind = isImageContentType(contentType) ? "image" : "attachment";
  let asset: { id: string };
  try {
    asset = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(assetTable)
        .values({
          workspaceId,
          documentId: id,
          objectKey: key,
          filename: body.filename,
          mimeType: contentType,
          size: bytes.byteLength,
          kind,
          surface: "document",
          createdBy: userId,
        })
        .returning({ id: assetTable.id });
      if (!row) throw new Error("The file was not saved");
      await tx.insert(documentFileTable).values({
        assetId: row.id,
        documentId: id,
        originalName: body.filename,
        sourceClient: body.sourceClient ?? null,
        sourceUserId: userId,
      });
      return row;
    });
  } catch (error) {
    // No row points at the object, so nothing else would ever remove it.
    await queueStorageCleanup(db, [key]);
    throw error;
  }

  const url = `${apiBaseUrl}/asset/${asset.id}`;
  const line = documentFileLine({
    url,
    filename: body.filename,
    contentType,
    size: bytes.byteLength,
  });
  try {
    await writeDocument(doc, userId, {
      content: doc.content ? `${doc.content}\n\n${line}` : line,
    });
  } catch (error) {
    // A file the text does not link would stay out of sight; the delete
    // queues its object for cleanup.
    await db.delete(assetTable).where(eq(assetTable.id, asset.id));
    throw error;
  }
  return { id: asset.id, url, kind, mimeType: contentType };
}
