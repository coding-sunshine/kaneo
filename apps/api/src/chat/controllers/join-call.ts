import { createCallSession } from "../call/call-session";
import { loadChannel } from "./load-channel";

export async function joinCall(
  workspaceId: string,
  channelId: string,
  userId: string,
) {
  await loadChannel(workspaceId, channelId, userId, "post");
  return (await createCallSession(channelId, userId)).session;
}
