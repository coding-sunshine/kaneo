import { and, desc, eq, isNull, ne, or, sql } from "drizzle-orm";
import type { z } from "zod";
import db from "../../database";
import { documentTable, userTable } from "../../database/schema";
import type { listDocumentsQuery } from "../schema";
import {
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

export const documentSummaryColumns = (userId: string) => ({
  id: documentTable.id,
  workspaceId: documentTable.workspaceId,
  title: documentTable.title,
  icon: documentTable.icon,
  color: documentTable.color,
  scope: documentTable.scope,
  projectId: documentTable.projectId,
  workProjectId: documentTable.workProjectId,
  taskId: documentTable.taskId,
  parentName: documentParentName(userId),
  kind: documentTable.kind,
  status: documentTable.status,
  sourceClient: documentTable.sourceClient,
  // Null for a topic the viewer cannot open.
  topicId: sql<string | null>`CASE
    WHEN ${topicAccess(userId, documentTable.topicId)} THEN ${documentTable.topicId}
  END`,
  filedAt: documentTable.filedAt,
  approvedAt: documentTable.approvedAt,
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
  if (query.projectId) {
    return and(
      eq(documentTable.scope, "team"),
      eq(documentTable.projectId, query.projectId),
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
