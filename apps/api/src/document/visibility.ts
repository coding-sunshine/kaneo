import { type SQLWrapper, sql } from "drizzle-orm";
import { projectAccessCondition } from "../project-access/project-access-condition";

type DocumentColumns = {
  id: SQLWrapper;
  creatorId: SQLWrapper;
  scope: SQLWrapper;
  projectId: SQLWrapper;
  workProjectId: SQLWrapper;
  taskId: SQLWrapper;
};

// Who may use a work project as a place for documents: anyone who can enter
// one of its teams. A project with no team is open to the whole workspace.
export function workProjectDocumentAccess(
  userId: string | SQLWrapper,
  workProjectId: SQLWrapper,
) {
  return sql<boolean>`(
    NOT EXISTS (
      SELECT 1 FROM work_project_team AS document_project_team
      WHERE document_project_team.work_project_id = ${workProjectId}
    )
    OR EXISTS (
      SELECT 1 FROM work_project_team AS document_project_team
      WHERE document_project_team.work_project_id = ${workProjectId}
        AND ${projectAccessCondition(userId, sql`document_project_team.project_id`)}
    )
  )`;
}

// Who can see a document through its parent, ignoring direct shares. Workspace
// documents are open to every workspace member; team and issue documents
// follow team access, and work project documents follow the project's teams.
// Callers check workspace membership.
export function documentParentAccess(
  userId: string | SQLWrapper,
  doc: DocumentColumns,
) {
  return sql<boolean>`(
    ${doc.scope} = 'workspace'
    OR (${doc.scope} = 'project' AND ${workProjectDocumentAccess(userId, doc.workProjectId)})
    OR (${doc.scope} = 'team' AND ${projectAccessCondition(userId, doc.projectId)})
    OR (${doc.scope} = 'issue' AND EXISTS (
      SELECT 1 FROM task AS document_task
      WHERE document_task.id = ${doc.taskId}
        AND ${projectAccessCondition(userId, sql`document_task.project_id`)}
    ))
  )`;
}

// The one visibility rule for documents: lists, reads and notifications.
export function documentVisibility(
  userId: string | SQLWrapper,
  doc: DocumentColumns,
) {
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
