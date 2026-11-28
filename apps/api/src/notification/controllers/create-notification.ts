import { createId } from "@paralleldrive/cuid2";
import db from "../../database";
import { notificationTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { deliverNotification } from "../../notification-preferences/delivery";

import { safeOutboundError } from "../../utils/outbound-request";
import { canReceiveResourceNotification } from "../resource-access";

type NotificationInput = {
  userId: string;
  title?: string | null;
  content?: string | null;
  type?: string;
  eventData?: Record<string, unknown> | null;
  resourceId?: string;
  resourceType?: string;
};
type Database = Pick<typeof db, "query" | "insert" | "select">;

// Whether the person may see the resource and has not turned this kind off.
async function mayReceive(
  { userId, type, resourceId, resourceType }: NotificationInput,
  database: Database,
) {
  if (
    !(await canReceiveResourceNotification(
      userId,
      resourceId,
      resourceType,
      database,
    ))
  ) {
    return false;
  }

  const preferenceKey =
    type === "task_assignee_changed" || type === "task_created"
      ? "taskAssignmentEnabled"
      : type === "task_comment" ||
          type === "task_mention" ||
          type === "document_comment" ||
          type === "document_mention"
        ? "taskCommentEnabled"
        : type === "task_status_changed"
          ? "taskStatusChangeEnabled"
          : type === "due_date_reminder" || type === "task_overdue"
            ? "dueDateReminderEnabled"
            : type === "document_proposed" ||
                type === "document_current" ||
                type === "document_decision"
              ? "topicUpdatesEnabled"
              : type === "stale_items"
                ? "staleItemsEnabled"
                : null;

  if (preferenceKey) {
    const preference =
      await database.query.userNotificationPreferenceTable.findFirst({
        where: (table, { eq }) => eq(table.userId, userId),
      });

    if (preference?.[preferenceKey] === false) {
      return false;
    }
  }
  return true;
}

const toRow = (input: NotificationInput) => ({
  id: createId(),
  userId: input.userId,
  title: input.title ?? null,
  content: input.content ?? null,
  type: input.type || "info",
  eventData: input.eventData ?? null,
  resourceId: input.resourceId || null,
  resourceType: input.resourceType || null,
});

export async function persistNotification(
  input: NotificationInput,
  database: Database = db,
) {
  if (!(await mayReceive(input, database))) return null;
  const [notification] = await database
    .insert(notificationTable)
    .values(toRow(input))
    .returning();
  return notification;
}

/**
 * Many notifications at once: each recipient passes the same checks as
 * createNotification, then the rows go in with one insert and each is
 * dispatched on its own.
 */
export async function createNotifications(inputs: NotificationInput[]) {
  const allowed: NotificationInput[] = [];
  for (const input of inputs)
    if (await mayReceive(input, db)) allowed.push(input);
  if (allowed.length === 0) return [];
  const notifications = await db
    .insert(notificationTable)
    .values(allowed.map(toRow))
    .returning();
  for (const notification of notifications)
    await dispatchNotification(notification);
  return notifications;
}

export async function dispatchNotification(
  notification: typeof notificationTable.$inferSelect,
) {
  await publishEvent("notification.created", {
    notificationId: notification.id,
    userId: notification.userId,
  });
  void deliverNotification(notification.id).catch((error) => {
    console.error("Failed to deliver notification", {
      notificationId: notification.id,
      error: safeOutboundError(error),
    });
  });
}

async function createNotification(
  data: Parameters<typeof persistNotification>[0],
) {
  const notification = await persistNotification(data);
  if (notification) await dispatchNotification(notification);
  return notification;
}

export default createNotification;
