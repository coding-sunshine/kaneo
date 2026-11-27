import {
  and,
  desc,
  eq,
  gt,
  isNull,
  ne,
  or,
  type SQLWrapper,
  sql,
} from "drizzle-orm";
import type { z } from "zod";
import db from "../../database";
import { documentTable, userTable } from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import type { listDocumentsQuery } from "../schema";
import {
  documentEditAccess,
  documentParentAccess,
  documentVisibility,
  topicAccess,
} from "../visibility";

// Team name, project name or issue key, for breadcrumbs and list rows. A
// document shared by name can sit in a team the viewer cannot enter; that
// team, and its issue keys, stay unnamed. A project is always named: every
// workspace member can list every project.
export const documentParentName = (userId: string) =>
  sql<string | null>`CASE
    WHEN ${documentTable.scope} = 'project' THEN (
      SELECT name FROM work_project WHERE id = ${documentTable.workProjectId}
    )
    WHEN NOT ${documentParentAccess(userId, documentTable)} THEN NULL
    WHEN ${documentTable.scope} = 'team' THEN (
      SELECT name FROM project WHERE id = ${documentTable.projectId}
    )
    WHEN ${documentTable.scope} = 'issue' THEN (
      SELECT p.slug || '-' || t.number FROM task AS t
      JOIN project AS p ON p.id = t.project_id
      WHERE t.id = ${documentTable.taskId}
    )
  END`;

// A document shared by name keeps the ids of a team or issue the viewer
// cannot open to itself, like the name above.
export const openParentId = (userId: string, id: SQLWrapper) =>
  sql<string | null>`CASE
    WHEN ${documentParentAccess(userId, documentTable)} THEN ${id}
  END`;

export const documentSummaryColumns = (userId: string) => ({
  id: documentTable.id,
  workspaceId: documentTable.workspaceId,
  title: documentTable.title,
  icon: documentTable.icon,
  color: documentTable.color,
  scope: documentTable.scope,
  projectId: openParentId(userId, documentTable.projectId),
  workProjectId: documentTable.workProjectId,
  taskId: openParentId(userId, documentTable.taskId),
  parentName: documentParentName(userId),
  kind: documentTable.kind,
  status: documentTable.status,
  sourceClient: documentTable.sourceClient,
  // Null for a topic the viewer cannot open.
  topicId: sql<string | null>`CASE
    WHEN ${topicAccess(userId, documentTable.topicId)} THEN ${documentTable.topicId}
  END`,
  filedAt: documentTable.filedAt,
  // On a proposal: the current document its author means to replace. Named
  // to the same people as the topic.
  replacesDocumentId: sql<string | null>`CASE
    WHEN ${documentTable.status} = 'in_review'
      AND ${topicAccess(userId, documentTable.topicId)}
    THEN ${documentTable.supersedesDocumentId}
  END`,
  // Null once the date has passed: the item is back in the Inbox.
  snoozedUntil: sql<Date | null>`CASE
    WHEN ${gt(documentTable.inboxSnoozedUntil, new Date())}
      THEN ${documentTable.inboxSnoozedUntil}
  END`.mapWith(documentTable.inboxSnoozedUntil),
  approvedAt: documentTable.approvedAt,
  canEdit: documentEditAccess(userId, documentTable).mapWith(Boolean),
  // Where a replaced document points: the current one of its topic. Null
  // unless the viewer can open the topic and that document.
  currentDocumentId: sql<string | null>`CASE
    WHEN ${documentTable.status} = 'superseded'
      AND ${topicAccess(userId, documentTable.topicId)}
    THEN (
      SELECT current_doc.id FROM document AS current_doc
      WHERE current_doc.topic_id = ${documentTable.topicId}
        AND current_doc.workspace_id = ${documentTable.workspaceId}
        AND current_doc.status = 'current'
        AND current_doc.deleted_at IS NULL
        AND ${documentVisibility(userId, {
          id: sql`current_doc.id`,
          workspaceId: sql`current_doc.workspace_id`,
          creatorId: sql`current_doc.creator_id`,
          scope: sql`current_doc.scope`,
          projectId: sql`current_doc.project_id`,
          workProjectId: sql`current_doc.work_project_id`,
          taskId: sql`current_doc.task_id`,
        })}
      LIMIT 1
    )
  END`,
  creatorId: documentTable.creatorId,
  creatorName: userTable.name,
  creatorImage: userTable.image,
  createdAt: documentTable.createdAt,
  updatedAt: documentTable.updatedAt,
});

function filterCondition(
  userId: string,
  query: z.infer<typeof listDocumentsQuery>,
) {
  // Linked in the text of either side. The issue has to be one the person
  // can open: for any other, and for one that does not exist, nothing matches.
  if (query.linkedTaskId) {
    return sql`EXISTS (
      SELECT 1 FROM task_document AS link
      JOIN task AS linked_task ON linked_task.id = link.task_id
      JOIN project AS linked_project ON linked_project.id = linked_task.project_id
      WHERE link.document_id = ${documentTable.id}
        AND link.task_id = ${query.linkedTaskId}
        AND linked_project.workspace_id = ${documentTable.workspaceId}
        AND ${projectAccessCondition(userId, sql`linked_project.id`)}
    )`;
  }
  if (query.projectId) {
    return and(
      eq(documentTable.scope, "team"),
      eq(documentTable.projectId, query.projectId),
      // A team the reader cannot open matches nothing, like an unknown one.
      documentParentAccess(userId, documentTable),
    );
  }
  if (query.workProjectId) {
    return and(
      eq(documentTable.scope, "project"),
      eq(documentTable.workProjectId, query.workProjectId),
    );
  }
  if (query.taskId) {
    return and(
      eq(documentTable.scope, "issue"),
      eq(documentTable.taskId, query.taskId),
      documentParentAccess(userId, documentTable),
    );
  }
  if (query.topicId) {
    return and(
      eq(documentTable.topicId, query.topicId),
      topicAccess(userId, documentTable.topicId),
    );
  }
  const sharedWithMe = sql`EXISTS (
    SELECT 1 FROM document_share AS shared_with_me
    WHERE shared_with_me.document_id = ${documentTable.id}
      AND shared_with_me.user_id = ${userId}
  )`;
  if (query.filter === "mine") {
    return eq(documentTable.creatorId, userId);
  }
  // No topic yet. A private draft waits with the people who can open it; a
  // document in a shared place waits in the Inbox. A private document never
  // has a topic: filing gives it the topic's place.
  if (query.filter === "unfiled") {
    return eq(documentTable.scope, "private");
  }
  if (query.filter === "inbox") {
    return and(
      isNull(documentTable.topicId),
      ne(documentTable.scope, "private"),
    );
  }
  // A proposal or a new current document on a topic the person follows, made
  // by somebody else after they followed and after their last visit.
  if (query.filter === "new") {
    const at = sql`CASE ${documentTable.status}
      WHEN 'current' THEN ${documentTable.approvedAt}
      WHEN 'in_review' THEN ${documentTable.filedAt}
    END`;
    // A proposal filed before the filer was recorded has its author stand in.
    const by = sql`CASE ${documentTable.status}
      WHEN 'current' THEN ${documentTable.approvedBy}
      ELSE COALESCE(${documentTable.filedById}, ${documentTable.creatorId})
    END`;
    return sql`${by} IS DISTINCT FROM ${userId}
      AND EXISTS (
        SELECT 1 FROM topic_subscriber AS followed
        WHERE followed.topic_id = ${documentTable.topicId}
          AND followed.user_id = ${userId}
          AND followed.created_at < ${at}
      )
      AND NOT EXISTS (
        SELECT 1 FROM workspace_member AS visitor
        WHERE visitor.workspace_id = ${documentTable.workspaceId}
          AND visitor.user_id = ${userId}
          AND visitor.documents_seen_at >= ${at}
      )`;
  }
  if (query.filter === "shared") {
    return and(
      or(isNull(documentTable.creatorId), ne(documentTable.creatorId, userId)),
      sharedWithMe,
    );
  }
  if (query.filter === "recent") {
    return or(
      eq(documentTable.creatorId, userId),
      eq(documentTable.updatedById, userId),
      sharedWithMe,
      sql`EXISTS (
        SELECT 1 FROM document_version AS my_edit
        WHERE my_edit.document_id = ${documentTable.id}
          AND my_edit.author_id = ${userId}
      )`,
    );
  }
  return undefined;
}

export function listDocuments(
  workspaceId: string,
  userId: string,
  query: z.infer<typeof listDocumentsQuery>,
) {
  return db
    .select(documentSummaryColumns(userId))
    .from(documentTable)
    .leftJoin(userTable, eq(userTable.id, documentTable.creatorId))
    .where(
      and(
        eq(documentTable.workspaceId, workspaceId),
        isNull(documentTable.deletedAt),
        documentVisibility(userId, documentTable),
        filterCondition(userId, query),
      ),
    )
    .orderBy(desc(documentTable.updatedAt));
}
