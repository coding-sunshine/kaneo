import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import { chatMessageFileTable, chatMessageTable } from "../../database/schema";
import {
  documentFileContentType,
  fileTypeRefused,
} from "../../document/file-types";
import { publishEvent } from "../../events";
import { withVerifiedStorageObject } from "../../storage/cleanup-queue";
import {
  createChatFileUploadUrl,
  InvalidUploadedAssetError,
  isChatFileKey,
  validateTaskAssetUploadInput,
  verifyTaskAssetUpload,
} from "../../storage/s3";
import type { chatFileUploadBody, finalizeChatFileBody } from "../schema";
import { syncMessageReferences } from "../mentions/sync-message-references";
import { loadChannel } from "./load-channel";
import { loadMessage } from "./load-message";
import { deleteDraft } from "./save-draft";

const wrongKey = "The upload key does not match the channel.";

// Sending a file is posting: the same people may do it and the same channels
// refuse it. Both routes ask, so a key alone opens nothing.
async function uploadTarget(
  workspaceId: string,
  channelId: string,
  userId: string,
  { filename, size }: z.infer<typeof chatFileUploadBody>,
) {
  await loadChannel(workspaceId, channelId, userId, "post");
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

export async function createChatFileUpload(
  workspaceId: string,
  channelId: string,
  userId: string,
  body: z.infer<typeof chatFileUploadBody>,
) {
  const contentType = await uploadTarget(workspaceId, channelId, userId, body);
  try {
    return await createChatFileUploadUrl({
      workspaceId,
      channelId,
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

/** Posts the uploaded file as a message of its own, with optional text. */
export async function finalizeChatFile(
  workspaceId: string,
  channelId: string,
  userId: string,
  body: z.infer<typeof finalizeChatFileBody>,
) {
  const contentType = await uploadTarget(workspaceId, channelId, userId, body);
  const key = body.key.trim();
  if (!isChatFileKey(key, { workspaceId, channelId })) {
    throw new HTTPException(400, { message: wrongKey });
  }
  const { messageId, created } = await withVerifiedStorageObject(
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
      const [stored] = await tx
        .select({
          messageId: chatMessageFileTable.messageId,
          channelId: chatMessageFileTable.channelId,
        })
        .from(chatMessageFileTable)
        .where(eq(chatMessageFileTable.objectKey, key))
        .limit(1);
      if (stored) {
        // A second finalize of the same upload answers with the same message.
        if (stored.channelId !== channelId) {
          throw new HTTPException(400, { message: wrongKey });
        }
        return { messageId: stored.messageId, created: false };
      }
      const text = body.body ?? "";
      const [message] = await tx
        .insert(chatMessageTable)
        .values({ channelId, userId, body: text })
        .returning({ id: chatMessageTable.id });
      if (!message) throw new Error("Message insert returned no row");
      await syncMessageReferences(tx, workspaceId, message.id, text);
      await tx.insert(chatMessageFileTable).values({
        workspaceId,
        channelId,
        messageId: message.id,
        objectKey: key,
        filename: body.filename,
        mimeType: uploaded.contentType,
        size: uploaded.size,
        uploadedBy: userId,
      });
      return { messageId: message.id, created: true };
    },
  );
  if (created) {
    // The text sent with the file came from the composer, as in a post.
    await deleteDraft(channelId, userId);
    await publishEvent("chat.message_created", {
      workspaceId,
      channelId,
      messageId,
      userId,
    });
  }
  return loadMessage(workspaceId, channelId, messageId, userId, "read");
}
