import { isSmtpConfigured, sendNotificationEmail } from "@kaneo/email";
import { and, eq, lte } from "drizzle-orm";
import {
  findUnreadChat,
  MIN_EMAIL_GAP_MS,
  type UnreadChat,
} from "../chat/email-fallback/find-unread-chat";
import { unreadChatEmail } from "../chat/email-fallback/unread-chat-email";
import db from "../database";
import {
  chatEmailFallbackTable,
  userNotificationPreferenceTable,
  userTable,
} from "../database/schema";
import { isWithinNotificationSchedule } from "../notification-preferences/schedule";
import { canReceiveResourceNotification } from "../notification/resource-access";

const DEFAULT_DELAY_MINUTES = 10;

export function chatEmailDelayMs() {
  const minutes = Number(process.env.CHAT_EMAIL_DELAY_MINUTES);
  return (
    (Number.isFinite(minutes) && minutes > 0
      ? minutes
      : DEFAULT_DELAY_MINUTES) * 60_000
  );
}

const clientUrl = () => process.env.KANEO_CLIENT_URL || "http://localhost:5173";

/**
 * Emails each person about direct messages and mentions they left unread for
 * the configured delay while away: one email listing them, at most one an
 * hour, held through their quiet hours. Claimed first, so of two runs that
 * see the same person, one sends; a failed send gives the claim back.
 */
export async function sendChatEmailFallbacks(
  now = new Date(),
): Promise<{ degraded: boolean }> {
  if (!isSmtpConfigured()) return { degraded: false };
  let degraded = false;
  const settledAt = new Date(now.getTime() - chatEmailDelayMs());
  const byUser = new Map<string, UnreadChat[]>();
  for (const row of await findUnreadChat(now, settledAt))
    byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), row]);
  for (const [userId, rows] of byUser) {
    try {
      await emailUser(userId, rows, now);
    } catch (error) {
      degraded = true;
      console.error("Failed to email unread chat", { userId, error });
    }
  }
  return { degraded };
}

async function emailUser(userId: string, rows: UnreadChat[], now: Date) {
  const [user] = await db
    .select({ email: userTable.email, locale: userTable.locale })
    .from(userTable)
    .where(eq(userTable.id, userId));
  if (!user?.email) return;
  const preference = await db.query.userNotificationPreferenceTable.findFirst({
    where: eq(userNotificationPreferenceTable.userId, userId),
  });
  if (preference && !isWithinNotificationSchedule(preference, now)) return;

  const readable: UnreadChat[] = [];
  for (const row of rows) {
    if (
      await canReceiveResourceNotification(
        userId,
        row.messageId,
        "chat_message",
      )
    )
      readable.push(row);
  }
  const newest = readable.at(-1);
  if (!newest) return;

  const [claimed] = await db
    .insert(chatEmailFallbackTable)
    .values({ userId, lastSentAt: now, emailedThrough: newest.createdAt })
    .onConflictDoUpdate({
      target: chatEmailFallbackTable.userId,
      set: { lastSentAt: now, emailedThrough: newest.createdAt },
      setWhere: lte(
        chatEmailFallbackTable.lastSentAt,
        new Date(now.getTime() - MIN_EMAIL_GAP_MS),
      ),
    })
    .returning();
  if (!claimed) return;

  const content = unreadChatEmail(readable, clientUrl());
  const result = await sendNotificationEmail(user.email, content.title, {
    ...content,
    locale: user.locale ?? null,
    settingsUrl: `${clientUrl()}/dashboard/settings/account/notifications`,
  }).catch((error: unknown) => ({ success: false, error }));
  if (result.success) return;

  await releaseClaim(userId, now, newest);
  throw new Error("The unread chat email was not sent");
}

async function releaseClaim(userId: string, now: Date, row: UnreadChat) {
  const mine = and(
    eq(chatEmailFallbackTable.userId, userId),
    eq(chatEmailFallbackTable.lastSentAt, now),
  );
  if (row.previousSentAt && row.previousThrough) {
    await db
      .update(chatEmailFallbackTable)
      .set({
        lastSentAt: row.previousSentAt,
        emailedThrough: row.previousThrough,
      })
      .where(mine);
  } else {
    await db.delete(chatEmailFallbackTable).where(mine);
  }
}
