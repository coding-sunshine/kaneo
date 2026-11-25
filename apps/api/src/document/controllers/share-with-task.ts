import { and, asc, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  projectTable,
  taskDocumentTable,
  taskTable,
} from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { audienceOf } from "./document-audience";
import { getDocument } from "./get-document";
import { loadDocument } from "./load-document";

type Database = Pick<typeof db, "insert">;

// An issue of the workspace the user can open. Any other id looks missing.
export async function loadTask(
  workspaceId: string,
  taskId: string,
  userId: string,
) {
  const [task] = await db
    .select({ id: taskTable.id })
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(
      and(
        eq(taskTable.id, taskId),
        eq(projectTable.workspaceId, workspaceId),
        projectAccessCondition(userId, projectTable.id),
      ),
    );
  if (!task) throw new HTTPException(404, { message: "Issue not found" });
  return task;
}

// The row that lets everyone who can open the issue view the document. It is
// a row of its own, so a later edit of the issue's text does not remove it.
export const grantTaskAccess = (
  database: Database,
  taskId: string,
  documentId: string,
  userId: string,
) =>
  database
    .insert(taskDocumentTable)
    .values({
      taskId,
      documentId,
      source: "share",
      createdBy: userId,
      grantsAccess: true,
    })
    .onConflictDoNothing();

/** How many of the people who can open an issue cannot open a document. */
export async function taskAudience(
  workspaceId: string,
  id: string,
  userId: string,
  taskId: string,
) {
  const doc = await loadDocument(workspaceId, id, userId);
  const task = await loadTask(workspaceId, taskId, userId);
  const [current, ofTask] = await Promise.all([
    audienceOf(workspaceId, doc),
    // No document and no creator: only the people the issue itself lets in.
    audienceOf(workspaceId, {
      id: null,
      creatorId: null,
      scope: "issue",
      projectId: null,
      workProjectId: null,
      taskId: task.id,
    }),
  ]);
  const open = new Set(current.map((person) => person.userId));
  return {
    total: ofTask.length,
    missing: ofTask.filter((person) => !open.has(person.userId)).length,
  };
}

export async function shareWithTask(
  workspaceId: string,
  id: string,
  userId: string,
  taskId: string,
) {
  await loadDocument(workspaceId, id, userId, { need: "edit" });
  const task = await loadTask(workspaceId, taskId, userId);
  await grantTaskAccess(db, task.id, id, userId);
  return getDocument(workspaceId, id, userId);
}

// Whoever may share the document may stop sharing it, also with an issue
// they cannot open themselves.
export async function unshareFromTask(
  workspaceId: string,
  id: string,
  userId: string,
  taskId: string,
) {
  await loadDocument(workspaceId, id, userId, { need: "edit" });
  await db
    .delete(taskDocumentTable)
    .where(
      and(
        eq(taskDocumentTable.documentId, id),
        eq(taskDocumentTable.taskId, taskId),
        eq(taskDocumentTable.source, "share"),
      ),
    );
  return getDocument(workspaceId, id, userId);
}

// The issues a document is shared with. Whoever manages the document sees
// every one, because each lets people in. An issue they cannot open comes
// without its name. Everyone else sees only issues they can open.
export function sharedTasksOf(
  workspaceId: string,
  id: string,
  userId: string,
  manages: boolean,
) {
  const open = projectAccessCondition(userId, projectTable.id);
  return db
    .select({
      id: taskTable.id,
      title: sql<string | null>`CASE WHEN ${open} THEN ${taskTable.title} END`,
      number: sql<
        number | null
      >`CASE WHEN ${open} THEN ${taskTable.number} END`,
      projectId: sql<
        string | null
      >`CASE WHEN ${open} THEN ${projectTable.id} END`,
      projectSlug: sql<
        string | null
      >`CASE WHEN ${open} THEN ${projectTable.slug} END`,
    })
    .from(taskDocumentTable)
    .innerJoin(taskTable, eq(taskTable.id, taskDocumentTable.taskId))
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(
      and(
        eq(taskDocumentTable.documentId, id),
        eq(taskDocumentTable.source, "share"),
        eq(projectTable.workspaceId, workspaceId),
        manages ? undefined : open,
      ),
    )
    .orderBy(asc(projectTable.slug), asc(taskTable.number));
}
