import { type SQLWrapper, sql } from "drizzle-orm";
import { isGuestCondition } from "../guest/guest-condition";
import { projectAccessCondition } from "../project-access/project-access-condition";

type DocumentColumns = {
  id: SQLWrapper;
  workspaceId: SQLWrapper;
  creatorId: SQLWrapper;
  scope: SQLWrapper;
  projectId: SQLWrapper;
  workProjectId: SQLWrapper;
  taskId: SQLWrapper;
};

// Who may use a work project as a place for documents: anyone who can enter
// one of its teams. A project with no team is open to the whole workspace,
// guests aside.
export function workProjectDocumentAccess(
  userId: string | SQLWrapper,
  workProjectId: SQLWrapper,
) {
  return sql<boolean>`(
    (
      NOT EXISTS (
        SELECT 1 FROM work_project_team AS document_project_team
        WHERE document_project_team.work_project_id = ${workProjectId}
      )
      AND NOT EXISTS (
        SELECT 1 FROM work_project AS document_work_project
        WHERE document_work_project.id = ${workProjectId}
          AND ${isGuestCondition(userId, sql`document_work_project.workspace_id`)}
      )
    )
    OR EXISTS (
      SELECT 1 FROM work_project_team AS document_project_team
      WHERE document_project_team.work_project_id = ${workProjectId}
        AND ${projectAccessCondition(userId, sql`document_project_team.project_id`)}
    )
  )`;
}

// Who can see a document through its parent, ignoring direct shares. Workspace
// documents are open to every workspace member but guests; team and issue documents
// follow team access, and work project documents follow the project's teams.
// Callers check workspace membership.
export function documentParentAccess(
  userId: string | SQLWrapper,
  doc: Pick<
    DocumentColumns,
    "workspaceId" | "scope" | "projectId" | "workProjectId" | "taskId"
  >,
) {
  return sql<boolean>`(
    (${doc.scope} = 'workspace' AND NOT ${isGuestCondition(userId, doc.workspaceId)})
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

// What every member of one team can open without a share by name: workspace
// documents, the team's own documents and those of its issues, a project with
// no team or with this team, and a document shared with one of its issues.
// For text that no signed-in person wrote, such as an integration's.
export function documentTeamAccess(
  teamId: string | SQLWrapper,
  doc: Omit<DocumentColumns, "creatorId">,
) {
  return sql<boolean>`(
    ${doc.scope} = 'workspace'
    OR (${doc.scope} = 'team' AND ${doc.projectId} = ${teamId})
    OR (${doc.scope} = 'issue' AND EXISTS (
      SELECT 1 FROM task AS team_document_task
      WHERE team_document_task.id = ${doc.taskId}
        AND team_document_task.project_id = ${teamId}
    ))
    OR (${doc.scope} = 'project' AND (
      NOT EXISTS (
        SELECT 1 FROM work_project_team AS team_document_project
        WHERE team_document_project.work_project_id = ${doc.workProjectId}
      )
      OR EXISTS (
        SELECT 1 FROM work_project_team AS team_document_project
        WHERE team_document_project.work_project_id = ${doc.workProjectId}
          AND team_document_project.project_id = ${teamId}
      )
    ))
    OR EXISTS (
      SELECT 1 FROM task_document AS team_grant
      JOIN task AS team_grant_task ON team_grant_task.id = team_grant.task_id
      WHERE team_grant.document_id = ${doc.id}
        AND team_grant.grants_access
        AND team_grant_task.project_id = ${teamId}
    )
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
        workspaceId: sql`visible_topic.workspace_id`,
        scope: sql`visible_topic.scope`,
        projectId: sql`visible_topic.project_id`,
        workProjectId: sql`visible_topic.work_project_id`,
        taskId: sql`NULL::text`,
      })}
  )`;
}

// Who may edit a document: the rule `loadDocument` applies at edit, as SQL,
// so lists can tell the reader which rows they may change.
export function documentEditAccess(
  userId: string | SQLWrapper,
  doc: DocumentColumns & {
    generalAccess: SQLWrapper;
    status: SQLWrapper;
    topicId: SQLWrapper;
  },
) {
  return sql<boolean>`(
    ${doc.creatorId} = ${userId}
    OR EXISTS (
      SELECT 1 FROM document_share AS edit_share
      WHERE edit_share.document_id = ${doc.id}
        AND edit_share.user_id = ${userId}
        AND edit_share.access = 'edit'
    )
    OR (${documentParentAccess(userId, doc)} AND (
      ${doc.generalAccess} = 'edit'
      OR (${doc.status} = 'current' AND EXISTS (
        SELECT 1 FROM topic AS edit_topic
        WHERE edit_topic.id = ${doc.topicId}
          AND ${userId} IN (edit_topic.decider_id, edit_topic.backup_decider_id)
      ))
    ))
  )`;
}
