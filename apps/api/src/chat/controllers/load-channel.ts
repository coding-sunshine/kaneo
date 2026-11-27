import { and, eq, isNull, or } from "drizzle-orm";
import { chatChannelTable } from "../../database/schema";
import { directMessageOpenToGuest } from "../../guest/direct-message-open-to-guest";
import { isWorkspaceGuest } from "../../guest/is-workspace-guest";
import { assertChannelAccess, type ChannelAction } from "../channel-access";
import { selectChannels } from "./select-channels";

// Looks the channel up inside the workspace from the URL, so an id from
// another workspace answers like a missing channel. A guest's direct message
// with someone they no longer work with answers the same way.
export async function loadChannel(
  workspaceId: string,
  channelId: string,
  userId: string,
  action: ChannelAction,
) {
  const guest = await isWorkspaceGuest(workspaceId, userId);
  const [channel] = await selectChannels(userId).where(
    and(
      eq(chatChannelTable.id, channelId),
      eq(chatChannelTable.workspaceId, workspaceId),
      guest
        ? or(
            isNull(chatChannelTable.directKey),
            directMessageOpenToGuest(userId, chatChannelTable.id, workspaceId),
          )
        : undefined,
    ),
  );
  assertChannelAccess(
    channel && { ...channel, archived: channel.archivedAt !== null, guest },
    action,
  );
  return channel as NonNullable<typeof channel>;
}
