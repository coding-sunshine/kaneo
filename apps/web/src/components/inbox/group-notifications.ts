import { isSameDay } from "date-fns";
import type { Notification } from "@/types/notification";

export type InboxFilter = "all" | "unread" | "mentions" | "priority" | "other";

// Linear's priority inbox: things aimed at you land in Priority, the rest in Other.
export const PRIORITY_TYPES = [
  "task_mention",
  "document_mention",
  "chat_mention",
  "chat_direct_message",
  "chat_reminder",
  "document_question",
  "task_assignee_changed",
  "due_date_reminder",
  "task_overdue",
];

const MENTION_TYPES = ["task_mention", "document_mention", "chat_mention"];

export const NOTIFICATION_TYPE_FILTERS = [
  { label: "Mentions", types: MENTION_TYPES },
  { label: "Comments", types: ["task_comment", "document_comment"] },
  {
    label: "Documents",
    types: [
      "document_proposed",
      "document_current",
      "document_decision",
      "document_replaced",
      "document_question",
      "document_inbox_waiting",
    ],
  },
  { label: "Status changes", types: ["task_status_changed"] },
  { label: "Assignments", types: ["task_assignee_changed"] },
  {
    label: "Reminders",
    types: ["due_date_reminder", "task_overdue", "stale_items"],
  },
];

export function filterNotifications(
  notifications: Notification[],
  filter: InboxFilter,
) {
  if (filter === "priority" || filter === "other") {
    return notifications.filter(
      (n) => PRIORITY_TYPES.includes(n.type) === (filter === "priority"),
    );
  }
  if (filter === "unread") {
    return notifications.filter((notification) => !notification.isRead);
  }
  if (filter === "mentions") {
    return notifications.filter((notification) =>
      MENTION_TYPES.includes(notification.type),
    );
  }
  return notifications;
}

export function groupNotifications(
  notifications: Notification[],
  now = new Date(),
) {
  const today: Notification[] = [];
  const earlier: Notification[] = [];

  for (const notification of notifications) {
    if (isSameDay(new Date(notification.createdAt), now)) {
      today.push(notification);
    } else {
      earlier.push(notification);
    }
  }

  return { today, earlier };
}
