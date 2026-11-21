import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { notificationTable } from "../../database/schema";

import type { PermissionMap } from "../../utils/role-permissions";
import { notificationReadAccess } from "../resource-access";

async function snoozeNotification(
  id: string,
  userId: string,
  snoozedUntil: Date | null,
  apiKeyPermissions?: PermissionMap | null,
) {
  const access = await notificationReadAccess(
    userId,
    notificationTable.resourceId,
    notificationTable.resourceType,
    apiKeyPermissions,
  );
  const [notification] = await db
    .update(notificationTable)
    .set({ snoozedUntil })
    .where(
      and(
        eq(notificationTable.id, id),
        eq(notificationTable.userId, userId),
        access,
      ),
    )
    .returning();

  if (!notification) {
    throw new HTTPException(404, {
      message: "Notification not found",
    });
  }

  return notification;
}

export default snoozeNotification;
