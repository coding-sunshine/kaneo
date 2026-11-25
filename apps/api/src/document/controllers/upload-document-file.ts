import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import { assetTable, documentFileTable } from "../../database/schema";
import { withVerifiedStorageObject } from "../../storage/cleanup-queue";
import {
  createDocumentFileUploadUrl,
  InvalidUploadedAssetError,
  isDocumentFileKey,
  isImageContentType,
  validateTaskAssetUploadInput,
  verifyTaskAssetUpload,
} from "../../storage/s3";
import { documentFileContentType, fileTypeRefused } from "../file-types";
import type {
  documentFileUploadBody,
  finalizeDocumentFileUploadBody,
} from "../schema";
import { assertNotSuperseded } from "./assert-not-superseded";
import { loadDocument } from "./load-document";

const wrongKey = "The upload key does not match the document.";

// Adding a file is an edit of the document: the same people may do it and the
// same documents refuse it. Both routes ask, so a key alone opens nothing.
async function uploadTarget(
  workspaceId: string,
  id: string,
  userId: string,
  { filename, size }: z.infer<typeof documentFileUploadBody>,
) {
  const doc = await loadDocument(workspaceId, id, userId, { need: "edit" });
  assertNotSuperseded(doc);
  const contentType = documentFileContentType(filename);
  if (!contentType) {
    throw new HTTPException(415, { message: fileTypeRefused });
  }
  try {
    validateTaskAssetUploadInput(contentType, size);
  } catch (error) {
    throw new HTTPException(400, {
      message: error instanceof Error ? error.message : "Invalid upload",
    });
  }
  return contentType;
}

export async function createDocumentFileUpload(
  workspaceId: string,
  id: string,
  userId: string,
  body: z.infer<typeof documentFileUploadBody>,
) {
  const contentType = await uploadTarget(workspaceId, id, userId, body);
  try {
    return await createDocumentFileUploadUrl({
      workspaceId,
      documentId: id,
      filename: body.filename,
      contentType,
      size: body.size,
    });
  } catch {
    throw new HTTPException(503, {
      message: "File uploads are not configured on this instance.",
    });
  }
}

export async function finalizeDocumentFileUpload(
  workspaceId: string,
  id: string,
  userId: string,
  body: z.infer<typeof finalizeDocumentFileUploadBody>,
) {
  const contentType = await uploadTarget(workspaceId, id, userId, body);
  const key = body.key.trim();
  if (!isDocumentFileKey(key, { workspaceId, documentId: id })) {
    throw new HTTPException(400, { message: wrongKey });
  }
  return withVerifiedStorageObject(
    key,
    async () => {
      try {
        return await verifyTaskAssetUpload(key, {
          size: body.size,
          contentType,
        });
      } catch (error) {
        const invalid = error instanceof InvalidUploadedAssetError;
        throw new HTTPException(invalid ? 400 : 503, {
          message: invalid
            ? error.message
            : "Unable to verify uploaded object.",
        });
      }
    },
    async (tx, uploaded) => {
      const file = {
        id: assetTable.id,
        kind: assetTable.kind,
        mimeType: assetTable.mimeType,
      };
      const [stored] = await tx
        .select({ ...file, documentId: assetTable.documentId })
        .from(assetTable)
        .where(eq(assetTable.objectKey, key))
        .limit(1);
      if (stored) {
        // A second finalize of the same upload answers with the same file.
        if (stored.documentId !== id) {
          throw new HTTPException(400, { message: wrongKey });
        }
        return stored;
      }
      const [asset] = await tx
        .insert(assetTable)
        .values({
          workspaceId,
          documentId: id,
          objectKey: key,
          filename: body.filename,
          mimeType: uploaded.contentType,
          size: uploaded.size,
          kind: isImageContentType(uploaded.contentType)
            ? "image"
            : "attachment",
          surface: "document",
          createdBy: userId,
        })
        .returning(file);
      if (!asset) {
        throw new HTTPException(500, { message: "Failed to save the file" });
      }
      await tx.insert(documentFileTable).values({
        assetId: asset.id,
        documentId: id,
        originalName: body.filename,
        sourceClient: "web",
        sourceUserId: userId,
      });
      return asset;
    },
  );
}
