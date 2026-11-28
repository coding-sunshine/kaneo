import { broadcastChatTyping } from "../../ws";
import { assertCanSendTyping } from "../typing-limit";
import { loadChannel } from "./load-channel";

/**
 * Tells the readers who have the channel open that the caller started or
 * stopped typing. Only someone who may post can type; nothing is stored.
 */
export async function sendTyping(
  workspaceId: string,
  channelId: string,
  userId: string,
  typing: boolean,
) {
  await loadChannel(workspaceId, channelId, userId, "post");
  assertCanSendTyping(userId, channelId, typing);
  await broadcastChatTyping(channelId, userId, typing);
  return { channelId, typing };
}
