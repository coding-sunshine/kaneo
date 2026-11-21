import { type SQLWrapper, sql } from "drizzle-orm";
import { projectAccessCondition } from "../project-access/project-access-condition";

type DocumentColumns = {
  id: SQLWrapper;
  creatorId: SQLWrapper;
  scope: SQLWrapper;
  projectId: SQLWrapper;
  taskId: SQLWrapper;
};

// Who can see a document through its parent, ignoring direct shares. Workspace
// and work project documents are open to every workspace member; team and
// issue documents follow team access. Callers check workspace membership.
export function documentParentAccess(userId: string, doc: DocumentColumns) {
  return sql<boolean>`(
    ${doc.scope} IN ('workspace', 'project')
    OR (${doc.scope} = 'team' AND ${projectAccessCondition(userId, doc.projectId)})
    OR (${doc.scope} = 'issue' AND EXISTS (
      SELECT 1 FROM task AS document_task
      WHERE document_task.id = ${doc.taskId}
        AND ${projectAccessCondition(userId, sql`document_task.project_id`)}
    ))
  )`;
}

// The one visibility rule for documents: lists, reads and notifications.
export function documentVisibility(userId: string, doc: DocumentColumns) {
  return sql<boolean>`(
    ${doc.creatorId} = ${userId}
    OR EXISTS (
      SELECT 1 FROM document_share AS visible_share
      WHERE visible_share.document_id = ${doc.id}
        AND visible_share.user_id = ${userId}
    )
    OR ${documentParentAccess(userId, doc)}
  )`;
}
