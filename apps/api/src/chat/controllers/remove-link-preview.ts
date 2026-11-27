import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { chatMessageTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { loadMessage } from "./load-message";

export async function removeLinkPreview(
  workspaceId: string,
  channelId: string,
  messageId: string,
  userId: string,
) {
  const message = await loadMessage(
    workspaceId,
    channelId,
    messageId,
    userId,
    "read",
  );
  if (message.userId !== userId)
    throw new HTTPException(403, {
      message: "Only the author can remove the preview",
    });
  await db
    .update(chatMessageTable)
    .set({ linkPreview: null })
    .where(eq(chatMessageTable.id, messageId));
  await publishEvent("chat.message_updated", {
    workspaceId,
    channelId,
    messageId,
  });
  return { ...message, linkPreview: null };
}
