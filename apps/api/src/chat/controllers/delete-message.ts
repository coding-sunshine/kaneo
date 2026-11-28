import { eq } from "drizzle-orm";
import db from "../../database";
import { chatMessageFileTable, chatMessageTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { queueStorageCleanup } from "../../storage/cleanup-queue";
import { loadOwnMessage } from "./load-message";

// A hard delete: rows keyed to the message cascade with it, and the stored
// objects of its files are queued for cleanup in the same transaction.
export async function deleteMessage(
  workspaceId: string,
  channelId: string,
  messageId: string,
  userId: string,
) {
  await loadOwnMessage(workspaceId, channelId, messageId, userId, "post");
  await db.transaction(async (tx) => {
    const files = await tx
      .select({ objectKey: chatMessageFileTable.objectKey })
      .from(chatMessageFileTable)
      .where(eq(chatMessageFileTable.messageId, messageId));
    await tx.delete(chatMessageTable).where(eq(chatMessageTable.id, messageId));
    await queueStorageCleanup(
      tx,
      files.map((file) => file.objectKey),
    );
  });
  await publishEvent("chat.message_deleted", {
    workspaceId,
    channelId,
    messageId,
  });
  return { messageId };
}
