import { and, eq } from "drizzle-orm";
import db from "../database";
import { pushDeviceTable } from "../database/schema";

export type PushPlatform = "ios" | "android";

// One row per token. A token registered again, by anyone, moves to that
// sign-in: a phone gets the pushes of whoever signed in on it last.
export async function registerDevice(input: {
  userId: string;
  sessionId: string;
  platform: PushPlatform;
  token: string;
}) {
  await db
    .insert(pushDeviceTable)
    .values(input)
    .onConflictDoUpdate({
      target: pushDeviceTable.token,
      set: {
        userId: input.userId,
        sessionId: input.sessionId,
        platform: input.platform,
        updatedAt: new Date(),
      },
    });
}

/** Removes the token only when it is yours, so nobody can silence another phone. */
export async function unregisterDevice(userId: string, token: string) {
  const removed = await db
    .delete(pushDeviceTable)
    .where(
      and(eq(pushDeviceTable.token, token), eq(pushDeviceTable.userId, userId)),
    )
    .returning({ id: pushDeviceTable.id });
  return removed.length > 0;
}
