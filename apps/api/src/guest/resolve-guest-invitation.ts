import { APIError } from "better-auth/api";
import { findGuestChannels, toChannelIds } from "./guest-channel-ids";
import { isGuestRole } from "./guest-roles";

// Checks the guest part of a new invitation. A guest joins as a member or
// viewer with selected project access and the channels named here, all of
// which the inviter must be able to see.
export async function resolveGuestInvitation(invitation: {
  organizationId: string;
  inviterId: string;
  role: string;
  guest?: unknown;
  channelIds?: unknown;
}) {
  if (invitation.guest !== true) return { guest: false, channelIds: [] };
  if (!isGuestRole(invitation.role)) {
    throw new APIError("BAD_REQUEST", {
      code: "GUEST_ROLE",
      message: "A guest can only be a member or a viewer",
    });
  }
  const requested = toChannelIds(invitation.channelIds);
  const channelIds = await findGuestChannels(
    invitation.organizationId,
    requested,
    invitation.inviterId,
  );
  if (channelIds.length !== requested.length) {
    throw new APIError("BAD_REQUEST", {
      code: "CHANNEL_NOT_FOUND",
      message: "Channel not found",
    });
  }
  return { guest: true, channelIds, projectAccess: "selected" as const };
}
