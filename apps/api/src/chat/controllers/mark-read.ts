import { and, eq } from "drizzle-orm";
import db from "../../database";
import { chatChannelMemberTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { loadChannel } from "./load-channel";

/**
 * Marks the channel read up to now for the caller only. Nobody else learns
 * of it: only the caller's own tabs are told to refresh their counts.
 */
export async function markRead(
  workspaceId: string,
  channelId: string,
  userId: string,
) {
  await loadChannel(workspaceId, channelId, userId, "read");
  await db
    .update(chatChannelMemberTable)
    .set({ lastReadAt: new Date() })
    .where(
      and(
        eq(chatChannelMemberTable.channelId, channelId),
        eq(chatChannelMemberTable.userId, userId),
      ),
    );
  await publishEvent("chat.channel_read", { workspaceId, userId });
  return { channelId };
}
