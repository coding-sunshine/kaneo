import { and, desc, eq, isNull, ne, or, sql } from "drizzle-orm";
import type { z } from "zod";
import db from "../../database";
import { documentTable, userTable } from "../../database/schema";
import type { listDocumentsQuery } from "../schema";
import { documentVisibility } from "../visibility";

export const documentSummaryColumns = {
  id: documentTable.id,
  workspaceId: documentTable.workspaceId,
  title: documentTable.title,
  icon: documentTable.icon,
  color: documentTable.color,
  scope: documentTable.scope,
  projectId: documentTable.projectId,
  workProjectId: documentTable.workProjectId,
  taskId: documentTable.taskId,
  creatorId: documentTable.creatorId,
  creatorName: userTable.name,
  creatorImage: userTable.image,
  createdAt: documentTable.createdAt,
  updatedAt: documentTable.updatedAt,
};

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
  if (query.filter === "mine") {
    return and(
      eq(documentTable.creatorId, userId),
      sql`${documentTable.scope} IN ('private', 'workspace')`,
    );
  }
  if (query.filter === "shared") {
    return and(
      or(isNull(documentTable.creatorId), ne(documentTable.creatorId, userId)),
      or(
        eq(documentTable.scope, "workspace"),
        sql`EXISTS (
          SELECT 1 FROM document_share AS shared_with_me
          WHERE shared_with_me.document_id = ${documentTable.id}
            AND shared_with_me.user_id = ${userId}
        )`,
      ),
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
    .select(documentSummaryColumns)
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
