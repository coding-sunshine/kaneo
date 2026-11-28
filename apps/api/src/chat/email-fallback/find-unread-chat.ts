import {
  and,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import db from "../../database";
import {
  chatChannelMemberTable,
  chatChannelMuteTable,
  chatChannelTable,
  chatEmailFallbackTable,
  chatMessageTable,
  chatPresenceTable,
  notificationTable,
  userNotificationPreferenceTable,
  userTable,
} from "../../database/schema";

const CHAT_TYPES = ["chat_direct_message", "chat_mention"];
// Long enough to outlast quiet hours over a long weekend, short enough that
// turning this on for an existing instance does not email old history.
const LOOKBACK_MS = 7 * 24 * 60 * 60_000;
export const MIN_EMAIL_GAP_MS = 60 * 60_000;
// Rows read per run, oldest first; the rest wait for the next minute. Rows
// held by quiet hours are read again each run, so this bounds that work.
export const MAX_ROWS_PER_RUN = 500;

/**
 * Inbox rows for direct messages and mentions that are still unread after
 * `settledAt`, for people not seen since then, who turned email on and left
 * chat email on, were not emailed in the last hour, and have not had this row
 * emailed already. Muted channels and messages read in the channel drop out.
 * Read access is checked by the caller, row by row.
 */
export function findUnreadChat(
  now: Date,
  settledAt: Date,
  limit = MAX_ROWS_PER_RUN,
) {
  const author = userTable;
  return db
    .select({
      notificationId: notificationTable.id,
      userId: notificationTable.userId,
      createdAt: notificationTable.createdAt,
      messageId: chatMessageTable.id,
      body: chatMessageTable.body,
      channelId: chatChannelTable.id,
      workspaceId: chatChannelTable.workspaceId,
      channelName: chatChannelTable.name,
      isDirect: sql<boolean>`${chatChannelTable.directKey} is not null`,
      authorName: author.name,
      previousSentAt: chatEmailFallbackTable.lastSentAt,
      previousThrough: chatEmailFallbackTable.emailedThrough,
    })
    .from(notificationTable)
    .innerJoin(
      chatMessageTable,
      eq(chatMessageTable.id, notificationTable.resourceId),
    )
    .innerJoin(
      chatChannelTable,
      eq(chatChannelTable.id, chatMessageTable.channelId),
    )
    .leftJoin(author, eq(author.id, chatMessageTable.userId))
    .leftJoin(
      chatEmailFallbackTable,
      eq(chatEmailFallbackTable.userId, notificationTable.userId),
    )
    .innerJoin(
      userNotificationPreferenceTable,
      eq(userNotificationPreferenceTable.userId, notificationTable.userId),
    )
    .where(
      and(
        inArray(notificationTable.type, CHAT_TYPES),
        eq(notificationTable.resourceType, "chat_message"),
        sql`${notificationTable.isRead} is not true`,
        or(
          isNull(notificationTable.snoozedUntil),
          lte(notificationTable.snoozedUntil, now),
        ),
        lte(notificationTable.createdAt, settledAt),
        gt(notificationTable.createdAt, new Date(now.getTime() - LOOKBACK_MS)),
        eq(userNotificationPreferenceTable.emailEnabled, true),
        eq(userNotificationPreferenceTable.chatEmailEnabled, true),
        or(
          isNull(chatEmailFallbackTable.userId),
          and(
            lte(
              chatEmailFallbackTable.lastSentAt,
              new Date(now.getTime() - MIN_EMAIL_GAP_MS),
            ),
            gt(
              notificationTable.createdAt,
              chatEmailFallbackTable.emailedThrough,
            ),
          ),
        ),
        notExists(
          db
            .select({ one: sql`1` })
            .from(chatChannelMuteTable)
            .where(
              and(
                eq(chatChannelMuteTable.channelId, chatChannelTable.id),
                eq(chatChannelMuteTable.userId, notificationTable.userId),
              ),
            ),
        ),
        notExists(
          db
            .select({ one: sql`1` })
            .from(chatChannelMemberTable)
            .where(
              and(
                eq(chatChannelMemberTable.channelId, chatChannelTable.id),
                eq(chatChannelMemberTable.userId, notificationTable.userId),
                sql`${chatChannelMemberTable.lastReadAt} >= ${chatMessageTable.createdAt}`,
              ),
            ),
        ),
        notExists(
          db
            .select({ one: sql`1` })
            .from(chatPresenceTable)
            .where(
              and(
                eq(chatPresenceTable.userId, notificationTable.userId),
                gt(chatPresenceTable.lastSeenAt, settledAt),
              ),
            ),
        ),
      ),
    )
    .orderBy(notificationTable.createdAt)
    .limit(limit);
}

export type UnreadChat = Awaited<ReturnType<typeof findUnreadChat>>[number];
