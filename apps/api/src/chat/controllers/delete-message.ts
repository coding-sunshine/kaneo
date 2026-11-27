import { eq } from "drizzle-orm";
import db from "../../database";
import { chatMessageTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { loadOwnMessage } from "./load-message";

// A hard delete: rows keyed to the message cascade with it.
export async function deleteMessage(
  workspaceId: string,
  channelId: string,
  messageId: string,
  userId: string,
) {
  await loadOwnMessage(workspaceId, channelId, messageId, userId, "post");
  await db.delete(chatMessageTable).where(eq(chatMessageTable.id, messageId));
  await publishEvent("chat.message_deleted", {
    workspaceId,
    channelId,
    messageId,
  });
  return { messageId };
}
