import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { chatMessageFileTable } from "../../database/schema";
import { privateObjectResponse } from "../../storage/private-object-response";
import { getPrivateObject } from "../../storage/s3";
import { loadChannel } from "./load-channel";

const notFound = () => new HTTPException(404, { message: "File not found" });

// The channel rules run first, so a hidden channel's file answers like a
// missing channel; a file id from another channel is missing here too.
export async function getChatFile(
  workspaceId: string,
  channelId: string,
  fileId: string,
  userId: string,
) {
  await loadChannel(workspaceId, channelId, userId, "read");
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
