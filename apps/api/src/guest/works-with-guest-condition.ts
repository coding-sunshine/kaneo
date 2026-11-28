import { type SQLWrapper, or } from "drizzle-orm";
import { sharesChannelCondition } from "./shares-channel-condition";
import { sharesProjectCondition } from "./shares-project-condition";

// The person in `memberId` shares one of the guest's projects or channels:
// the only people a guest may hold a direct message with.
export function worksWithGuestCondition(
  guestId: string | SQLWrapper,
  memberId: SQLWrapper,
  workspaceId: string | SQLWrapper,
) {
  return or(
    sharesProjectCondition(guestId, memberId, workspaceId),
    sharesChannelCondition(guestId, memberId, workspaceId),
  );
}
