import { asc, eq } from "drizzle-orm";
import db from "../../database";
import { chatChannelMemberTable } from "../../database/schema";
import { loadChannel } from "./load-channel";

export async function getChannel(
  workspaceId: string,
  channelId: string,
  userId: string,
) {
  const channel = await loadChannel(workspaceId, channelId, userId, "read");
  const members = await db
    .select({ userId: chatChannelMemberTable.userId })
    .from(chatChannelMemberTable)
    .where(eq(chatChannelMemberTable.channelId, channelId))
    .orderBy(asc(chatChannelMemberTable.joinedAt));
  return { ...channel, memberIds: members.map((member) => member.userId) };
}
