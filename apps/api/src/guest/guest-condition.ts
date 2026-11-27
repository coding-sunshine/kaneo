import { type SQLWrapper, sql } from "drizzle-orm";

// True when the person is a guest of the workspace. Guests never get what is
// open to "everyone in the workspace".
export function isGuestCondition(
  userId: string | SQLWrapper,
  workspaceId: SQLWrapper,
) {
  return sql<boolean>`EXISTS (
    SELECT 1 FROM workspace_member_access AS guest_rule
    WHERE guest_rule.workspace_id = ${workspaceId}
      AND guest_rule.user_id = ${sql`${userId}`}
      AND guest_rule.guest
  )`;
}
