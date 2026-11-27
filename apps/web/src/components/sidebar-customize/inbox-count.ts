import { PRIORITY_TYPES } from "@/components/inbox/group-notifications";
import { isSnoozed } from "@/components/inbox/snooze";
import type { InboxCountMode } from "@/components/sidebar-customize/sidebar-items";
import type { Notification } from "@/types/notification";

/**
 * Unread, non-snoozed notifications that count toward the Inbox badge, plus
 * unread direct messages, which are written to you like a mention.
 */
export function inboxCount(
  notifications: Notification[],
  mode: InboxCountMode,
  directMessagesUnread = 0,
): number {
  if (mode === "none") return 0;
  return (
    directMessagesUnread +
    notifications.filter(
      (notification) =>
        !notification.isRead &&
        !isSnoozed(notification) &&
        (mode === "all" || PRIORITY_TYPES.includes(notification.type)),
    ).length
  );
}
