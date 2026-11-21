import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { workspaceEmojiTable } from "../../database/schema";
import {
  assertWorkspaceEmojiKeyMatchesContext,
  createWorkspaceEmojiUploadUrl,
  deleteS3Object,
  InvalidUploadedAssetError,
  verifyTaskAssetUpload,
} from "../../storage/s3";
import { emojiNameTaken, emojiUrl } from "./emoji-queries";

type Upload = { name: string; contentType: string; size: number };

const taken = (name: string) =>
  new HTTPException(409, {
    message: `Emoji with name "${name}" already exists. Please choose a different name.`,
  });

export async function prepareEmojiUpload(workspaceId: string, input: Upload) {
  if (await emojiNameTaken(workspaceId, input.name)) throw taken(input.name);
  try {
    return await createWorkspaceEmojiUploadUrl({ workspaceId, ...input });
  } catch {
    throw new HTTPException(503, {
      message: "Image uploads are not configured",
    });
  }
}

export async function createEmoji(
  workspaceId: string,
  userId: string,
  requestUrl: string,
  input: Upload & { key: string; version: string },
) {
  const key = input.key.trim();
  if (
    !assertWorkspaceEmojiKeyMatchesContext(key, {
      workspaceId,
      version: input.version,
    })
  ) {
    throw new HTTPException(400, {
      message: "Image upload key does not match the workspace.",
    });
  }
  if (await emojiNameTaken(workspaceId, input.name)) throw taken(input.name);

  // The declared size was validated against the 500 KB limit; the stored
  // object must match it exactly.
  try {
    await verifyTaskAssetUpload(key, input);
  } catch (error) {
    if (error instanceof InvalidUploadedAssetError) {
      throw new HTTPException(400, { message: error.message });
    }
    throw new HTTPException(503, { message: "Unable to verify upload" });
  }

  const [emoji] = await db
    .insert(workspaceEmojiTable)
    .values({
      workspaceId,
      name: input.name,
      objectKey: key,
      mimeType: input.contentType,
      version: input.version,
      createdBy: userId,
    })
    .onConflictDoNothing()
    .returning();
  if (!emoji) {
    deleteS3Object(key).catch(() => {});
    throw taken(input.name);
  }

  return {
    id: emoji.id,
    name: emoji.name,
    url: emojiUrl(requestUrl, emoji),
    createdBy: emoji.createdBy,
    createdAt: emoji.createdAt,
  };
}
