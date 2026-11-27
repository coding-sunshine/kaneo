import db from "../database";
import { chatChannelMemberTable } from "../database/schema";
import { findGuestChannels, toChannelIds } from "./guest-channel-ids";

// Puts a guest who accepted an invitation into its channels.
export async function addGuestToChannels(
  invitation: {
    organizationId: string;
    guest?: unknown;
    channelIds?: unknown;
  },
  userId: string,
) {
  if (invitation.guest !== true) return;
  const channelIds = await findGuestChannels(
    invitation.organizationId,
    toChannelIds(invitation.channelIds),
  );
  if (channelIds.length === 0) return;
  await db
    .insert(chatChannelMemberTable)
    .values(channelIds.map((channelId) => ({ channelId, userId })))
    .onConflictDoNothing();
}
