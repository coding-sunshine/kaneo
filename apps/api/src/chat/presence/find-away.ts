import { and, inArray, lt } from "drizzle-orm";
import db from "../../database";
import { chatPresenceTable } from "../../database/schema";
import { ONLINE_WINDOW_MS } from "./list-online";

/**
 * Of these people, the ones presence shows as away: they turned it on and
 * were not seen lately. Someone who keeps presence off counts as around.
 */
export async function findAway(userIds: string[]) {
  if (userIds.length === 0) return new Set<string>();
  const rows = await db
    .select({ userId: chatPresenceTable.userId })
    .from(chatPresenceTable)
    .where(
      and(
        inArray(chatPresenceTable.userId, userIds),
        lt(
          chatPresenceTable.lastSeenAt,
          new Date(Date.now() - ONLINE_WINDOW_MS),
        ),
      ),
    );
  return new Set(rows.map((row) => row.userId));
}
