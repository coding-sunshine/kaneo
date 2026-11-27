import db from "../../database";
import { chatChannelMemberTable } from "../../database/schema";
import { getChannel } from "./get-channel";
import { loadChannel } from "./load-channel";

export async function joinChannel(
  workspaceId: string,
  channelId: string,
  userId: string,
) {
  await loadChannel(workspaceId, channelId, userId, "join");
  await db
    .insert(chatChannelMemberTable)
    .values({ channelId, userId })
    .onConflictDoNothing();
  return getChannel(workspaceId, channelId, userId);
}
