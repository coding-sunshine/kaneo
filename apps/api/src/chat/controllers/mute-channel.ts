import { and, eq } from "drizzle-orm";
import db from "../../database";
import { chatChannelMuteTable } from "../../database/schema";
import { loadChannel } from "./load-channel";

/**
 * Mutes or unmutes the channel for the caller only. Anyone who can read the
 * channel may mute it, joined or not, so a mention never arrives unstoppable.
 */
export async function muteChannel(
  workspaceId: string,
  channelId: string,
  userId: string,
  muted: boolean,
) {
  await loadChannel(workspaceId, channelId, userId, "read");
  if (muted)
    await db
      .insert(chatChannelMuteTable)
      .values({ channelId, userId })
      .onConflictDoNothing();
  else
    await db
      .delete(chatChannelMuteTable)
      .where(
        and(
          eq(chatChannelMuteTable.channelId, channelId),
          eq(chatChannelMuteTable.userId, userId),
        ),
      );
  return { channelId, muted };
}
