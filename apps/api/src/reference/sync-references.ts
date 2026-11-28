import { and, eq, inArray } from "drizzle-orm";
import type db from "../database";
import {
  activityTable,
  documentTable,
  projectTable,
  type ReferencePlace,
  referenceTable,
  taskTable,
} from "../database/schema";
import {
  findDocumentIds,
  findProjectIds,
  findTaskReferences,
} from "../task-document/find-links";
import { resolveTaskReferences } from "../task-document/resolve-tasks";

type Database = Pick<typeof db, "select" | "insert" | "delete">;
type Source = { taskId: string } | { documentId: string };

/**
 * Whether a text can name a ticket, a document or a team. No lookup, so
 * cheap: a comment that names nothing before and after its save changes no
 * reference.
 */
export function mayReference(text: string | null | undefined) {
  if (!text) return false;
  if (text.includes("/document/") || text.includes("/project/")) return true;
  const { ids, keys } = findTaskReferences(text);
  return ids.length > 0 || keys.length > 0;
}

async function workspaceOf(database: Database, source: Source) {
  const [row] =
    "taskId" in source
      ? await database
          .select({ workspaceId: projectTable.workspaceId })
          .from(taskTable)
          .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
          .where(eq(taskTable.id, source.taskId))
      : await database
          .select({ workspaceId: documentTable.workspaceId })
          .from(documentTable)
          .where(eq(documentTable.id, source.documentId));
  return row?.workspaceId ?? null;
}

// What one place of a source names, only things of its own workspace, and
// never the source itself. A chat message is no ticket or document, so it
// passes no source.
export async function findTargets(
  database: Database,
  workspaceId: string,
  source: Source | null,
  text: string,
) {
  const documentIds = findDocumentIds(text, workspaceId);
  const projectIds = findProjectIds(text, workspaceId);
  // One after another: a caller's transaction is one connection.
  const tasks = await resolveTaskReferences(
    database,
    workspaceId,
    findTaskReferences(text),
  );
  const documents = documentIds.length
    ? await database
        .select({ id: documentTable.id })
        .from(documentTable)
        .where(
          and(
            eq(documentTable.workspaceId, workspaceId),
            inArray(documentTable.id, documentIds),
          ),
        )
    : [];
  const projects = projectIds.length
    ? await database
        .select({ id: projectTable.id })
        .from(projectTable)
        .where(
          and(
            eq(projectTable.workspaceId, workspaceId),
            inArray(projectTable.id, projectIds),
          ),
        )
    : [];
  const self = !source
    ? null
    : "taskId" in source
      ? source.taskId
      : source.documentId;
  return [
    ...tasks.filter((id) => id !== self).map((id) => ({ targetTaskId: id })),
    ...documents
      .filter(({ id }) => id !== self)
      .map(({ id }) => ({ targetDocumentId: id })),
    ...projects.map(({ id }) => ({ targetProjectId: id })),
  ];
}

/** Makes the references of one place of a source match its texts. */
export async function syncReferences(
  database: Database,
  source: Source,
  place: ReferencePlace,
  texts: (string | null | undefined)[],
) {
  const workspaceId = await workspaceOf(database, source);
  if (!workspaceId) return;
  const text = texts.filter(Boolean).join("\n");
  const targets = text
    ? await findTargets(database, workspaceId, source, text)
    : [];
  const columns =
    "taskId" in source
      ? { sourceTaskId: source.taskId }
      : { sourceDocumentId: source.documentId };
  await database
    .delete(referenceTable)
    .where(
      and(
        "taskId" in source
          ? eq(referenceTable.sourceTaskId, source.taskId)
          : eq(referenceTable.sourceDocumentId, source.documentId),
        eq(referenceTable.place, place),
      ),
    );
  if (!targets.length) return;
  await database
    .insert(referenceTable)
    .values(
      targets.map((target) => ({ workspaceId, ...columns, place, ...target })),
    )
    .onConflictDoNothing();
}

/** The references of a ticket's description. */
export const syncTaskDescriptionReferences = (
  database: Database,
  taskId: string,
  description: string | null | undefined,
) => syncReferences(database, { taskId }, "description", [description]);

/** The references of a ticket's comments. Any comment can carry one, so all are read. */
export async function syncTaskCommentReferences(
  database: Database,
  taskId: string,
) {
  const comments = await database
    .select({ content: activityTable.content })
    .from(activityTable)
    .where(
      and(eq(activityTable.taskId, taskId), eq(activityTable.type, "comment")),
    );
  await syncReferences(
    database,
    { taskId },
    "comment",
    comments.map((comment) => comment.content),
  );
}

/** The references of a document's text. */
export const syncDocumentReferences = (
  database: Database,
  documentId: string,
  content: string | null | undefined,
) => syncReferences(database, { documentId }, "document", [content]);
