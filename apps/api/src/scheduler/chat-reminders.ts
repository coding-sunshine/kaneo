import { and, eq, isNull, lte } from "drizzle-orm";
import db from "../database";
import { chatReminderTable } from "../database/schema";
import createNotification from "../notification/controllers/create-notification";
import { findChannelReaders } from "../ws/chat-channel-readers";

/**
 * Tells each person whose /remind came due, in their own Inbox only, as long
 * as they can still read the channel they set it in. Claimed first, so of two
 * runs that see the same reminder, one sends.
 */
export async function checkChatReminders(
  now = new Date(),
): Promise<{ degraded: boolean }> {
  let degraded = false;
  const due = await db
    .select({ id: chatReminderTable.id })
    .from(chatReminderTable)
    .where(
      and(
        isNull(chatReminderTable.sentAt),
        lte(chatReminderTable.remindAt, now),
      ),
    );
  for (const { id } of due) {
    try {
      const [claimed] = await db
        .update(chatReminderTable)
        .set({ sentAt: now })
        .where(
          and(eq(chatReminderTable.id, id), isNull(chatReminderTable.sentAt)),
        )
        .returning();
      if (!claimed) continue;
      const access = await findChannelReaders(claimed.channelId, [
        claimed.userId,
      ]);
      if (
        access?.workspaceId !== claimed.workspaceId ||
        !access.readers.has(claimed.userId)
      )
        continue;
      await createNotification({
        userId: claimed.userId,
        type: "chat_reminder",
        title: "Reminder",
        content: claimed.note || null,
        eventData: {
          workspaceId: claimed.workspaceId,
          channelId: claimed.channelId,
          note: claimed.note,
        },
        resourceId: claimed.workspaceId,
        resourceType: "workspace",
      });
    } catch (error) {
      degraded = true;
      console.error("Failed to send a chat reminder", {
        reminderId: id,
        error,
      });
    }
  }
  return { degraded };
}
