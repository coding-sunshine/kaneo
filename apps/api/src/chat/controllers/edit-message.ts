import { eq } from "drizzle-orm";
import db from "../../database";
import { chatMessageTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { loadMessage, loadOwnMessage } from "./load-message";

export async function editMessage(
  workspaceId: string,
  channelId: string,
  messageId: string,
  userId: string,
  body: string,
) {
  await loadOwnMessage(workspaceId, channelId, messageId, userId, "post");
  await db
    .update(chatMessageTable)
    .set({ body, editedAt: new Date() })
    .where(eq(chatMessageTable.id, messageId));
  await publishEvent("chat.message_updated", {
    workspaceId,
    channelId,
    messageId,
  });
  return loadMessage(workspaceId, channelId, messageId, userId, "read");
}
