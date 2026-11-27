import { type SQLWrapper, sql } from "drizzle-orm";
import { worksWithGuestCondition } from "./works-with-guest-condition";

// Everyone else in the direct message works with the guest. Sharing can end
// after the conversation started, and then the guest loses it.
export function directMessageOpenToGuest(
  guestId: string,
  channelId: SQLWrapper,
  workspaceId: string,
) {
  return sql<boolean>`NOT EXISTS (
    SELECT 1 FROM chat_channel_member AS other_seat
    WHERE other_seat.channel_id = ${channelId}
      AND other_seat.user_id <> ${guestId}
      AND NOT (${worksWithGuestCondition(guestId, sql`other_seat.user_id`, workspaceId)})
  )`;
}
