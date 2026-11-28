import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { chatMessageFileTable } from "../../database/schema";
import { privateObjectResponse } from "../../storage/private-object-response";
import { getPrivateObject } from "../../storage/s3";
import { chatFileRefused } from "../file-access";
import { loadChannel } from "./load-channel";

const notFound = () => new HTTPException(404, { message: "File not found" });

// The channel rules run first. Every channel the person cannot read, and a
// missing one, answers the same 403, so the file URL tells nothing about
// which channels exist. A file id from another channel is missing here.
export async function getChatFile(
  workspaceId: string,
  channelId: string,
  fileId: string,
  userId: string,
) {
  try {
    await loadChannel(workspaceId, channelId, userId, "read");
  } catch (error) {
    if (error instanceof HTTPException && error.status === 404) {
      throw chatFileRefused();
    }
    throw error;
  }
  const [file] = await db
    .select({
      objectKey: chatMessageFileTable.objectKey,
      filename: chatMessageFileTable.filename,
      mimeType: chatMessageFileTable.mimeType,
    })
    .from(chatMessageFileTable)
    .where(
      and(
        eq(chatMessageFileTable.id, fileId),
        eq(chatMessageFileTable.channelId, channelId),
      ),
    )
    .limit(1);
  if (!file) throw notFound();
  let object: Awaited<ReturnType<typeof getPrivateObject>>;
  try {
    object = await getPrivateObject(file.objectKey);
  } catch (error) {
    console.error("Failed to stream chat file:", error);
    throw notFound();
  }
  return privateObjectResponse(object, {
    filename: file.filename,
    mimeType: file.mimeType,
    cacheControl: "private, max-age=120",
  });
}
