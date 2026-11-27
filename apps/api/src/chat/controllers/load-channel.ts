import { and, eq } from "drizzle-orm";
import { chatChannelTable } from "../../database/schema";
import { assertChannelAccess, type ChannelAction } from "../channel-access";
import { selectChannels } from "./select-channels";

// Looks the channel up inside the workspace from the URL, so an id from
// another workspace answers like a missing channel.
export async function loadChannel(
  workspaceId: string,
  channelId: string,
  userId: string,
  action: ChannelAction,
) {
  const [channel] = await selectChannels(userId).where(
    and(
      eq(chatChannelTable.id, channelId),
      eq(chatChannelTable.workspaceId, workspaceId),
    ),
  );
  assertChannelAccess(
    channel && { ...channel, archived: channel.archivedAt !== null },
    action,
  );
  return channel as NonNullable<typeof channel>;
}
