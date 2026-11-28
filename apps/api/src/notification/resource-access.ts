import { and, eq, inArray, type SQLWrapper, sql } from "drizzle-orm";
import db from "../database";
import {
  userTable,
  workspaceRoleTable,
  workspaceUserTable,
} from "../database/schema";
import { documentVisibility } from "../document/visibility";
import { directMessageOpenToGuest } from "../guest/direct-message-open-to-guest";
import { projectAccessCondition } from "../project-access/project-access-condition";
import { hasInstanceAdminRole } from "../utils/instance-admin-role";
import { type PermissionMap, rolesAllow } from "../utils/role-permissions";
import { splitRoles } from "../utils/split-roles";
import { notBannedCondition } from "../utils/user-ban";
import { workspacePermissionGrants } from "../utils/workspace-permission-grants";

// Membership, rather than public visibility or global admin privileges, defines
// who may be subscribed to private task activity. Archived workspaces hide
// their notifications until restored. Use the same predicate when
// creating, reading and delivering notifications, including historical rows.
export function notificationResourceAccess(
  userId: string,
  resourceId: string | null | SQLWrapper,
  resourceType: string | null | SQLWrapper,
  readGrants?: { taskWorkspaceIds: string[]; workspaceIds: string[] },
) {
  const taskRead = readGrants
    ? inArray(
        sql`notification_project.workspace_id`,
        readGrants.taskWorkspaceIds,
      )
    : sql`true`;
  const workspaceRead = readGrants
    ? inArray(sql`notification_member.workspace_id`, readGrants.workspaceIds)
    : sql`true`;
  const documentRead = readGrants
    ? inArray(
        sql`notification_document.workspace_id`,
        readGrants.taskWorkspaceIds,
      )
    : sql`true`;
  return sql<boolean>`(
    (${resourceId}::text IS NULL AND ${resourceType}::text IS NULL)
    OR (${resourceType}::text = 'task' AND EXISTS (
      SELECT 1 FROM task AS notification_task
      JOIN project AS notification_project ON notification_project.id = notification_task.project_id
      JOIN workspace_member AS notification_member ON notification_member.workspace_id = notification_project.workspace_id
      JOIN workspace AS notification_workspace ON notification_workspace.id = notification_project.workspace_id
      WHERE notification_task.id = ${resourceId} AND notification_member.user_id = ${userId}
        AND notification_workspace.archived_at IS NULL
        AND ${projectAccessCondition(userId, sql`notification_project.id`)}
        AND ${taskRead}
    ))
    OR (${resourceType}::text = 'workspace' AND EXISTS (
      SELECT 1 FROM workspace_member AS notification_member
      JOIN workspace AS notification_workspace ON notification_workspace.id = notification_member.workspace_id
      WHERE notification_member.workspace_id = ${resourceId} AND notification_member.user_id = ${userId}
        AND notification_workspace.archived_at IS NULL
        AND ${workspaceRead}
    ))
    OR (${resourceType}::text = 'document' AND EXISTS (
      SELECT 1 FROM document AS notification_document
      JOIN workspace_member AS notification_member ON notification_member.workspace_id = notification_document.workspace_id
      JOIN workspace AS notification_workspace ON notification_workspace.id = notification_document.workspace_id
      WHERE notification_document.id = ${resourceId} AND notification_member.user_id = ${userId}
        AND notification_workspace.archived_at IS NULL
        AND notification_document.deleted_at IS NULL
        AND ${documentVisibility(userId, {
          id: sql`notification_document.id`,
          workspaceId: sql`notification_document.workspace_id`,
          creatorId: sql`notification_document.creator_id`,
          scope: sql`notification_document.scope`,
          projectId: sql`notification_document.project_id`,
          workProjectId: sql`notification_document.work_project_id`,
          taskId: sql`notification_document.task_id`,
        })}
        AND ${documentRead}
    ))
    OR (${resourceType}::text = 'chat_message' AND EXISTS (
      SELECT 1 FROM chat_message AS notification_chat_message
      JOIN chat_channel AS notification_chat_channel ON notification_chat_channel.id = notification_chat_message.channel_id
      JOIN workspace_member AS notification_member ON notification_member.workspace_id = notification_chat_channel.workspace_id
      JOIN workspace AS notification_workspace ON notification_workspace.id = notification_chat_channel.workspace_id
      LEFT JOIN workspace_member_access AS notification_chat_access
        ON notification_chat_access.workspace_id = notification_chat_channel.workspace_id
        AND notification_chat_access.user_id = ${userId}
      WHERE notification_chat_message.id = ${resourceId} AND notification_member.user_id = ${userId}
        AND notification_workspace.archived_at IS NULL
        AND (
          (notification_chat_channel.is_private = false AND notification_chat_access.guest IS NOT TRUE)
          OR (
            EXISTS (
              SELECT 1 FROM chat_channel_member AS notification_chat_seat
              WHERE notification_chat_seat.channel_id = notification_chat_channel.id
                AND notification_chat_seat.user_id = ${userId}
            )
            AND (
              notification_chat_access.guest IS NOT TRUE
              OR notification_chat_channel.direct_key IS NULL
              OR ${directMessageOpenToGuest(userId, sql`notification_chat_channel.id`, sql`notification_chat_channel.workspace_id`)}
            )
          )
        )
        AND ${workspaceRead}
    ))
  )`;
}

// Apply current role and key grants in SQL before list limits or UPDATE RETURNING.
// One batch covers every involved workspace, regardless of notification count.
export async function notificationReadAccess(
  userId: string,
  resourceId: string | null | SQLWrapper,
  resourceType: string | null | SQLWrapper,
  apiKeyPermissions?: PermissionMap | null,
  workspaceId?: string,
) {
  const grants = await workspacePermissionGrants(userId, {
    apiKeyPermissions,
    workspaceIds: workspaceId ? [workspaceId] : undefined,
  });
  return notificationResourceAccess(userId, resourceId, resourceType, {
    taskWorkspaceIds: grants.workspaceIds.filter((id) =>
      grants.allows(id, { task: ["read"] }),
    ),
    workspaceIds: grants.workspaceIds.filter((id) =>
      grants.allows(id, { workspace: ["read"] }),
    ),
  });
}

export async function canReceiveResourceNotification(
  userId: string,
  resourceId?: string | null,
  resourceType?: string | null,
  database: Pick<typeof db, "select"> = db,
) {
  // Keep creation/delivery authorization to one SELECT, including when the
  // caller injects a transaction. Joining the current resource's role rows
  // avoids adding grant lookups for every recipient or scheduled reminder.
  const workspaceId = sql<string>`CASE
    WHEN ${resourceType ?? null}::text = 'workspace' THEN ${resourceId ?? null}::text
    WHEN ${resourceType ?? null}::text = 'task' THEN (
      SELECT recipient_project.workspace_id FROM task AS recipient_task
      JOIN project AS recipient_project ON recipient_project.id = recipient_task.project_id
      WHERE recipient_task.id = ${resourceId ?? null}
    )
    WHEN ${resourceType ?? null}::text = 'document' THEN (
      SELECT recipient_document.workspace_id FROM document AS recipient_document
      WHERE recipient_document.id = ${resourceId ?? null}
    )
    WHEN ${resourceType ?? null}::text = 'chat_message' THEN (
      SELECT recipient_channel.workspace_id FROM chat_message AS recipient_message
      JOIN chat_channel AS recipient_channel ON recipient_channel.id = recipient_message.channel_id
      WHERE recipient_message.id = ${resourceId ?? null}
    )
  END`;
  const rows = await database
    .select({
      id: userTable.id,
      instanceRole: userTable.role,
      memberRole: workspaceUserTable.role,
      storedRole: workspaceRoleTable.role,
      permission: workspaceRoleTable.permission,
    })
    .from(userTable)
    .leftJoin(
      workspaceUserTable,
      and(
        eq(workspaceUserTable.userId, userTable.id),
        eq(workspaceUserTable.workspaceId, workspaceId),
      ),
    )
    .leftJoin(
      workspaceRoleTable,
      eq(workspaceRoleTable.workspaceId, workspaceUserTable.workspaceId),
    )
    .where(
      and(
        eq(userTable.id, userId),
        notBannedCondition(),
        notificationResourceAccess(
          userId,
          resourceId ?? null,
          resourceType ?? null,
        ),
      ),
    );
  if (!rows.length) return false;
  if (!resourceId && !resourceType) return true;
  if (hasInstanceAdminRole(rows[0]?.instanceRole)) return true;
  const required: PermissionMap =
    resourceType === "task" || resourceType === "document"
      ? { task: ["read"] }
      : { workspace: ["read"] };
  return rolesAllow(
    splitRoles(rows[0]?.memberRole),
    rows.flatMap((row) =>
      row.storedRole
        ? [{ role: row.storedRole, permission: row.permission }]
        : [],
    ),
    required,
  );
}
