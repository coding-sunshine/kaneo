import { and, eq, gt, or } from "drizzle-orm";
import db from "../../database";
import { chatPresenceTable, workspaceUserTable } from "../../database/schema";
import { isWorkspaceGuest } from "../../guest/is-workspace-guest";
import { worksWithGuestCondition } from "../../guest/works-with-guest-condition";
import { getPresenceSetting } from "./set-presence";

// Clients send a heartbeat every 30 seconds while chat is open.
export const ONLINE_WINDOW_MS = 90_000;

/**
 * Workspace members who turned presence on and were seen recently. Only a
 * caller who turned it on too sees anyone; no time is ever returned. A guest
 * sees only themselves and the people who share one of their projects or
 * channels.
 */
export async function listOnline(workspaceId: string, userId: string) {
  if (!(await getPresenceSetting(userId)).enabled) return { online: [] };
  const guest = await isWorkspaceGuest(workspaceId, userId);
  const rows = await db
    .select({ userId: chatPresenceTable.userId })
    .from(chatPresenceTable)
    .innerJoin(
      workspaceUserTable,
      and(
        eq(workspaceUserTable.userId, chatPresenceTable.userId),
        eq(workspaceUserTable.workspaceId, workspaceId),
      ),
    )
    .where(
      and(
        gt(
          chatPresenceTable.lastSeenAt,
          new Date(Date.now() - ONLINE_WINDOW_MS),
        ),
        guest
          ? or(
              eq(chatPresenceTable.userId, userId),
              worksWithGuestCondition(
                userId,
                chatPresenceTable.userId,
                workspaceId,
              ),
            )
          : undefined,
      ),
    );
  return { online: rows.map((row) => row.userId) };
}
