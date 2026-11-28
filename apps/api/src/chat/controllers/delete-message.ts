import { eq, inArray } from "drizzle-orm";
import db from "../../database";
import {
  chatMessageFileTable,
  chatMessageTable,
  chatThreadReplyTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { queueStorageCleanup } from "../../storage/cleanup-queue";
import { loadOwnMessage } from "./load-message";

// A hard delete: rows keyed to the message cascade with it, and the stored
// objects of its files are queued for cleanup in the same transaction. The
// first message of a thread takes its replies with it.
export async function deleteMessage(
  workspaceId: string,
  channelId: string,
  messageId: string,
  userId: string,
) {
  await loadOwnMessage(workspaceId, channelId, messageId, userId, "post");
  await db.transaction(async (tx) => {
    const replies = await tx
      .select({ id: chatThreadReplyTable.messageId })
      .from(chatThreadReplyTable)
      .where(eq(chatThreadReplyTable.parentId, messageId));
    const ids = [messageId, ...replies.map((reply) => reply.id)];
    const files = await tx
      .select({ objectKey: chatMessageFileTable.objectKey })
      .from(chatMessageFileTable)
      .where(inArray(chatMessageFileTable.messageId, ids));
    await tx.delete(chatMessageTable).where(inArray(chatMessageTable.id, ids));
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
