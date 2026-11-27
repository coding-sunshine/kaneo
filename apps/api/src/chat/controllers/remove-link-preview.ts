import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { chatMessageTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { loadChannel } from "./load-channel";
import { selectMessages } from "./select-messages";

export async function removeLinkPreview(
  workspaceId: string,
  channelId: string,
  messageId: string,
  userId: string,
) {
  await loadChannel(workspaceId, channelId, userId, "read");
  const inChannel = and(
    eq(chatMessageTable.id, messageId),
    eq(chatMessageTable.channelId, channelId),
  );
  const [message] = await selectMessages().where(inChannel);
  if (!message) throw new HTTPException(404, { message: "Message not found" });
  if (message.userId !== userId)
    throw new HTTPException(403, {
      message: "Only the author can remove the preview",
    });
  await db.update(chatMessageTable).set({ linkPreview: null }).where(inChannel);
  await publishEvent("chat.message_updated", {
    workspaceId,
    channelId,
    messageId,
  });
  return { ...message, linkPreview: null };
}
