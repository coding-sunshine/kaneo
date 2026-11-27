import { eq } from "drizzle-orm";
import db from "../../database";
import { chatPresenceTable } from "../../database/schema";

export async function getPresenceSetting(userId: string) {
  const [row] = await db
    .select({ userId: chatPresenceTable.userId })
    .from(chatPresenceTable)
    .where(eq(chatPresenceTable.userId, userId));
  return { enabled: Boolean(row) };
}

export async function setPresenceSetting(userId: string, enabled: boolean) {
  if (enabled)
    await db
      .insert(chatPresenceTable)
      .values({ userId, lastSeenAt: new Date() })
      .onConflictDoUpdate({
        target: chatPresenceTable.userId,
        set: { lastSeenAt: new Date() },
      });
  else
    await db
      .delete(chatPresenceTable)
      .where(eq(chatPresenceTable.userId, userId));
  return { enabled };
}

/** Marks the user as seen now; does nothing while presence is off. */
export async function recordHeartbeat(userId: string) {
  const updated = await db
    .update(chatPresenceTable)
    .set({ lastSeenAt: new Date() })
    .where(eq(chatPresenceTable.userId, userId))
    .returning({ userId: chatPresenceTable.userId });
  return { enabled: updated.length > 0 };
}
