import { sql } from "drizzle-orm";
import { notificationTable } from "../database/schema";

// Resolve the resource's current workspace, rather than trusting eventData,
// which integrations can supply and older notifications may omit.
export function notificationWorkspaceFilter(workspaceId?: string) {
  if (!workspaceId) return undefined;
  return sql<boolean>`(
    (${notificationTable.resourceId} IS NULL AND ${notificationTable.resourceType} IS NULL)
    OR
    (${notificationTable.resourceType} = 'workspace' AND ${notificationTable.resourceId} = ${workspaceId})
    OR (${notificationTable.resourceType} = 'task' AND EXISTS (
      SELECT 1 FROM task AS inbox_task
      JOIN project AS inbox_project ON inbox_project.id = inbox_task.project_id
      WHERE inbox_task.id = ${notificationTable.resourceId}
        AND inbox_project.workspace_id = ${workspaceId}
    ))
    OR (${notificationTable.resourceType} = 'document' AND EXISTS (
      SELECT 1 FROM document AS inbox_document
      WHERE inbox_document.id = ${notificationTable.resourceId}
        AND inbox_document.workspace_id = ${workspaceId}
    ))
    OR (${notificationTable.resourceType} = 'chat_message' AND EXISTS (
      SELECT 1 FROM chat_message AS inbox_chat_message
      JOIN chat_channel AS inbox_chat_channel ON inbox_chat_channel.id = inbox_chat_message.channel_id
      WHERE inbox_chat_message.id = ${notificationTable.resourceId}
        AND inbox_chat_channel.workspace_id = ${workspaceId}
    ))
  )`;
}
