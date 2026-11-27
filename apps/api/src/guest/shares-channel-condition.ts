import { type SQLWrapper, sql } from "drizzle-orm";

// The person in `memberId` is in an open, non-direct channel of the
// workspace that the viewer is in too.
export function sharesChannelCondition(
  viewerId: string | SQLWrapper,
  memberId: SQLWrapper,
  workspaceId: string | SQLWrapper,
) {
  return sql<boolean>`EXISTS (
    SELECT 1 FROM chat_channel AS shared_channel
    JOIN chat_channel_member AS viewer_seat
      ON viewer_seat.channel_id = shared_channel.id
      AND viewer_seat.user_id = ${viewerId}
    JOIN chat_channel_member AS member_seat
      ON member_seat.channel_id = shared_channel.id
      AND member_seat.user_id = ${memberId}
    WHERE shared_channel.workspace_id = ${workspaceId}
      AND shared_channel.direct_key IS NULL
      AND shared_channel.archived_at IS NULL
  )`;
}
