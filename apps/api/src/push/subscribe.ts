import { subscribeToEvent } from "../events";
import { sendChatPush } from "./chat-push";

subscribeToEvent<{
  workspaceId: string;
  channelId: string;
  messageId: string;
  userId?: string;
}>("chat.message_created", async (event) => {
  if (event.channelId && event.messageId) await sendChatPush(event);
});
