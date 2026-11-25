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
  doc: Pick<
    DocumentColumns,
    "scope" | "projectId" | "workProjectId" | "taskId"
  >,
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

// A document shared with an issue is open to everyone who can open the issue.
// A link in the issue's text alone lets in nobody.
export function documentTaskAccess(
  userId: string | SQLWrapper,
  documentId: SQLWrapper,
) {
  return sql<boolean>`EXISTS (
    SELECT 1 FROM task_document AS visible_grant
    JOIN task AS visible_grant_task
      ON visible_grant_task.id = visible_grant.task_id
    JOIN project AS visible_grant_team
      ON visible_grant_team.id = visible_grant_task.project_id
    JOIN document AS visible_grant_document
      ON visible_grant_document.id = visible_grant.document_id
    WHERE visible_grant.document_id = ${documentId}
      AND visible_grant.grants_access
      AND visible_grant_team.workspace_id = visible_grant_document.workspace_id
      AND ${projectAccessCondition(userId, sql`visible_grant_task.project_id`)}
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
    OR ${documentTaskAccess(userId, doc.id)}
  )`;
}

// A topic lives in a place, and is open to whoever can open that place.
export function topicAccess(userId: string | SQLWrapper, topicId: SQLWrapper) {
  return sql<boolean>`EXISTS (
    SELECT 1 FROM topic AS visible_topic
    WHERE visible_topic.id = ${topicId}
      AND ${documentParentAccess(userId, {
        scope: sql`visible_topic.scope`,
        projectId: sql`visible_topic.project_id`,
        workProjectId: sql`visible_topic.work_project_id`,
        taskId: sql`NULL::text`,
      })}
  )`;
}
