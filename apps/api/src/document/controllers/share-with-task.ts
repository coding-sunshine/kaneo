import { and, asc, count, eq, inArray, not } from "drizzle-orm";
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

/** Who of the people who can open an issue cannot open a document. */
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
  // Named for the asker, who can open the issue and so may know who else can.
  const gains = ofTask.filter((person) => !open.has(person.userId));
  return { total: ofTask.length, missing: gains.length, gains };
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

// The issues a document is shared with that the viewer can open. An issue
// they cannot open is left out, not even its id is named, also to someone
// who manages the document.
export function sharedTasksOf(workspaceId: string, id: string, userId: string) {
  return db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      number: taskTable.number,
      projectId: projectTable.id,
      projectSlug: projectTable.slug,
    })
    .from(taskDocumentTable)
    .innerJoin(taskTable, eq(taskTable.id, taskDocumentTable.taskId))
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(
      and(
        eq(taskDocumentTable.documentId, id),
        eq(taskDocumentTable.source, "share"),
        eq(projectTable.workspaceId, workspaceId),
        projectAccessCondition(userId, projectTable.id),
      ),
    )
    .orderBy(asc(projectTable.slug), asc(taskTable.number));
}

// Shares on issues of this workspace the viewer cannot open.
const hiddenShares = (workspaceId: string, id: string, userId: string) =>
  and(
    eq(taskDocumentTable.documentId, id),
    eq(taskDocumentTable.source, "share"),
    inArray(
      taskDocumentTable.taskId,
      db
        .select({ id: taskTable.id })
        .from(taskTable)
        .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
        .where(
          and(
            eq(projectTable.workspaceId, workspaceId),
            not(projectAccessCondition(userId, projectTable.id)),
          ),
        ),
    ),
  );

// How many of those there are, never which: someone who manages the document
// knows people get in through issues they cannot see, and nothing more.
export async function countHiddenSharedTasks(
  workspaceId: string,
  id: string,
  userId: string,
) {
  const [row] = await db
    .select({ total: count() })
    .from(taskDocumentTable)
    .where(hiddenShares(workspaceId, id, userId));
  return row?.total ?? 0;
}

export async function unshareHiddenTasks(
  workspaceId: string,
  id: string,
  userId: string,
) {
  await loadDocument(workspaceId, id, userId, { need: "edit" });
  await db
    .delete(taskDocumentTable)
    .where(hiddenShares(workspaceId, id, userId));
  return getDocument(workspaceId, id, userId);
}
