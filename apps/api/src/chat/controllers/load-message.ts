import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { chatMessageTable } from "../../database/schema";
import type { ChannelAction } from "../channel-access";
import { withMentions } from "../mentions/with-mentions";
import { loadChannel } from "./load-channel";
import { selectMessages } from "./select-messages";
import { withFiles } from "./with-files";
import { withReactions } from "./with-reactions";

// The channel rules run first, so a hidden channel's messages answer 404 like
// missing ones; a message id from another channel is missing here too.
export async function loadMessage(
  workspaceId: string,
  channelId: string,
  messageId: string,
  userId: string,
  action: ChannelAction,
) {
  await loadChannel(workspaceId, channelId, userId, action);
  const [message] = await selectMessages().where(
    and(
      eq(chatMessageTable.id, messageId),
      eq(chatMessageTable.channelId, channelId),
    ),
  );
  if (!message) throw new HTTPException(404, { message: "Message not found" });
  const [withCards] = await withMentions(
    workspaceId,
    userId,
    await withFiles(await withReactions([message])),
  );
  return withCards as NonNullable<typeof withCards>;
}

export async function loadOwnMessage(...args: Parameters<typeof loadMessage>) {
  const message = await loadMessage(...args);
  if (message.userId !== args[3])
    throw new HTTPException(403, {
      message: "Only the author can change this message",
    });
  return message;
}
