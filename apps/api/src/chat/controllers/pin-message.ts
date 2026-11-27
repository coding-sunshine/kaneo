import { eq } from "drizzle-orm";
import db from "../../database";
import { chatMessageTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { loadMessage } from "./load-message";

/** Pins or unpins a message; any member who can post may do either. */
export async function pinMessage(
  workspaceId: string,
  channelId: string,
  messageId: string,
  userId: string,
  pinned: boolean,
) {
  await loadMessage(workspaceId, channelId, messageId, userId, "post");
  await db
    .update(chatMessageTable)
    .set(
      pinned
        ? { pinnedAt: new Date(), pinnedBy: userId }
        : { pinnedAt: null, pinnedBy: null },
    )
    .where(eq(chatMessageTable.id, messageId));
  await publishEvent("chat.message_updated", {
    workspaceId,
    channelId,
    messageId,
  });
  return loadMessage(workspaceId, channelId, messageId, userId, "read");
}
