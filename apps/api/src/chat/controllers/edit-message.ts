import { eq } from "drizzle-orm";
import db from "../../database";
import { chatMessageTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { syncMessageReferences } from "../../reference/sync-references";
import { loadMessage, loadOwnMessage } from "./load-message";

export async function editMessage(
  workspaceId: string,
  channelId: string,
  messageId: string,
  userId: string,
  body: string,
) {
  await loadOwnMessage(workspaceId, channelId, messageId, userId, "post");
  await db.transaction(async (tx) => {
    await tx
      .update(chatMessageTable)
      .set({ body, editedAt: new Date() })
      .where(eq(chatMessageTable.id, messageId));
    await syncMessageReferences(tx, messageId, body);
  });
  await publishEvent("chat.message_updated", {
    workspaceId,
    channelId,
    messageId,
  });
  return loadMessage(workspaceId, channelId, messageId, userId, "read");
}
