import { PRIORITY_TYPES } from "@/components/inbox/group-notifications";
import { isSnoozed } from "@/components/inbox/snooze";
import type { InboxCountMode } from "@/components/sidebar-customize/sidebar-items";
import type { Notification } from "@/types/notification";

/** Unread, non-snoozed notifications that count toward the Inbox badge. */
export function inboxCount(
  notifications: Notification[],
  mode: InboxCountMode,
): number {
  if (mode === "none") return 0;
  return notifications.filter(
    (notification) =>
      !notification.isRead &&
      !isSnoozed(notification) &&
      (mode === "all" || PRIORITY_TYPES.includes(notification.type)),
  ).length;
}
