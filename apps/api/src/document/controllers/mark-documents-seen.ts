import { and, eq, sql } from "drizzle-orm";
import db from "../../database";
import { workspaceUserTable } from "../../database/schema";

// Records the newest change on a followed topic that the Documents page has
// shown this member. The time only moves forward, and never past now: a
// change that lands after the page loaded must still count as new.
export async function markDocumentsSeen(
  workspaceId: string,
  userId: string,
  until: string,
) {
  const seenAt = new Date(Math.min(new Date(until).getTime(), Date.now()));
  const column = workspaceUserTable.documentsSeenAt;
  const [member] = await db
    .update(workspaceUserTable)
    // GREATEST skips a null, so a first visit takes the new time.
    .set({
      documentsSeenAt: sql`GREATEST(${column}, ${sql.param(seenAt, column)})`,
    })
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        eq(workspaceUserTable.userId, userId),
      ),
    )
    .returning({ seenAt: column });
  return { seenAt: member?.seenAt ?? null };
}
