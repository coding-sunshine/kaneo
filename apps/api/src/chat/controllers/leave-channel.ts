import { and, eq } from "drizzle-orm";
import db from "../../database";
import { chatChannelMemberTable } from "../../database/schema";
import { loadChannel } from "./load-channel";

export async function leaveChannel(
  workspaceId: string,
  channelId: string,
  userId: string,
) {
  await loadChannel(workspaceId, channelId, userId, "read");
  await db
    .delete(chatChannelMemberTable)
    .where(
      and(
        eq(chatChannelMemberTable.channelId, channelId),
        eq(chatChannelMemberTable.userId, userId),
      ),
    );
  return { channelId };
}
