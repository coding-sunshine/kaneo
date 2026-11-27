import { and, count, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  chatChannelMemberTable,
  chatChannelTable,
} from "../../database/schema";
import { publishEvent } from "../../events";

// An admin takes someone out of a channel. Every chat read checks membership,
// so the person loses the channel with their next request.
export async function removeMember(
  workspaceId: string,
  channelId: string,
  memberId: string,
) {
  const [channel] = await db
    .select({ id: chatChannelTable.id, isPrivate: chatChannelTable.isPrivate })
    .from(chatChannelTable)
    .where(
      and(
        eq(chatChannelTable.id, channelId),
        eq(chatChannelTable.workspaceId, workspaceId),
      ),
    );
  if (!channel) throw new HTTPException(404, { message: "Channel not found" });
  // Nobody could see or reopen a private channel without members.
  if (channel.isPrivate) {
    const [members] = await db
      .select({ total: count() })
      .from(chatChannelMemberTable)
      .where(eq(chatChannelMemberTable.channelId, channelId));
    if ((members?.total ?? 0) <= 1)
      throw new HTTPException(409, {
        message: "The last member cannot leave a private channel",
      });
  }
  const removed = await db
    .delete(chatChannelMemberTable)
    .where(
      and(
        eq(chatChannelMemberTable.channelId, channelId),
        eq(chatChannelMemberTable.userId, memberId),
      ),
    )
    .returning({ userId: chatChannelMemberTable.userId });
  if (removed.length === 0)
    throw new HTTPException(404, { message: "Member not found" });
  // Calls run outside Kaneo, so they need telling too.
  await publishEvent("chat.member_left", {
    workspaceId,
    channelId,
    userId: memberId,
  });
  return { channelId, userId: memberId };
}
