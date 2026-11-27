import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import db from "../database";
import {
  documentTable,
  projectTable,
  taskDocumentTable,
  taskTable,
} from "../database/schema";
import { audienceOf } from "../document/controllers/document-audience";

/** For each document, the workspace members who may open it. */
export async function findDocumentReaders(
  workspaceId: string,
  documentIds: string[],
) {
  if (!documentIds.length) return [];
  const documents = await db
    .select({
      id: documentTable.id,
      creatorId: documentTable.creatorId,
      scope: documentTable.scope,
      projectId: documentTable.projectId,
      workProjectId: documentTable.workProjectId,
      taskId: documentTable.taskId,
    })
    .from(documentTable)
    .where(
      and(
        eq(documentTable.workspaceId, workspaceId),
        inArray(documentTable.id, documentIds),
        isNull(documentTable.deletedAt),
      ),
    );
  return Promise.all(
    documents.map(async (document) => ({
      documentId: document.id,
      userIds: (await audienceOf(workspaceId, document)).map(
        (reader) => reader.userId,
      ),
    })),
  );
}

/** The team of each issue, so only people who can open it hear of it. */
export function findTaskProjects(workspaceId: string, taskIds: string[]) {
  if (!taskIds.length) return Promise.resolve([]);
  return db
    .select({ taskId: taskTable.id, projectId: taskTable.projectId })
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        inArray(taskTable.id, taskIds),
      ),
    );
}

/** The documents a new issue links to in its text, read after it committed. */
export async function findLinkedDocumentIds(taskId: string) {
  const [rows, [task]] = await Promise.all([
    db
      .select({ documentId: taskDocumentTable.documentId })
      .from(taskDocumentTable)
      .where(
        and(
          eq(taskDocumentTable.taskId, taskId),
          ne(taskDocumentTable.source, "share"),
        ),
      ),
    db
      .select({ workspaceId: projectTable.workspaceId })
      .from(taskTable)
      .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
      .where(eq(taskTable.id, taskId)),
  ]);
  return task && rows.length
    ? {
        workspaceId: task.workspaceId,
        documentIds: [...new Set(rows.map((row) => row.documentId))],
      }
    : null;
}
