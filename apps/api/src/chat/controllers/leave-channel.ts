import { and, count, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { chatChannelMemberTable } from "../../database/schema";
import { loadChannel } from "./load-channel";

export async function leaveChannel(
  workspaceId: string,
  channelId: string,
  userId: string,
) {
  const channel = await loadChannel(workspaceId, channelId, userId, "leave");
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
