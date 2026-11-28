import { and, count, eq, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { chatReminderTable } from "../../database/schema";

// Far more than anyone keeps in mind at once; stops a script from filling the
// table. Only reminders still waiting count.
export const MAX_OPEN_REMINDERS = 50;

export async function assertReminderRoom(userId: string) {
  const [open] = await db
    .select({ count: count() })
    .from(chatReminderTable)
    .where(
      and(
        eq(chatReminderTable.userId, userId),
        isNull(chatReminderTable.sentAt),
      ),
    );
  if ((open?.count ?? 0) < MAX_OPEN_REMINDERS) return;
  throw new HTTPException(409, {
    message: `You already have ${MAX_OPEN_REMINDERS} reminders waiting. Wait for one to arrive before setting another.`,
  });
}
