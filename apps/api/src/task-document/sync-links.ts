import { and, eq, inArray, like, notInArray, or } from "drizzle-orm";
import type db from "../database";
import {
  activityTable,
  documentTable,
  projectTable,
  type TaskDocumentSource,
  taskDocumentTable,
  taskTable,
} from "../database/schema";
import { isSameProjectKey } from "../project/project-key";
import { findDocumentIds, findTaskReferences } from "./find-links";

type Database = Pick<typeof db, "select" | "insert" | "delete">;

// Makes the rows of one place match its text. A link that is gone loses its
// row, a new link gets one, and a row that stays keeps who made it and what
// it grants. Whoever saves the text need not be able to open the other side:
// a row lets nobody into anything.
async function reconcile(
  database: Database,
  source: TaskDocumentSource,
  anchor: { taskId: string } | { documentId: string },
  others: string[],
  userId: string | null,
) {
  const [own, other, id] =
    "taskId" in anchor
      ? [taskDocumentTable.taskId, taskDocumentTable.documentId, anchor.taskId]
      : [
          taskDocumentTable.documentId,
          taskDocumentTable.taskId,
          anchor.documentId,
        ];
  await database
    .delete(taskDocumentTable)
    .where(
      and(
        eq(own, id),
        eq(taskDocumentTable.source, source),
        others.length ? notInArray(other, others) : undefined,
      ),
    );
  if (!others.length) return;
  await database
    .insert(taskDocumentTable)
    .values(
      others.map((otherId) => ({
        ...("taskId" in anchor
          ? { taskId: id, documentId: otherId }
          : { taskId: otherId, documentId: id }),
        source,
        createdBy: userId,
      })),
    )
    .onConflictDoNothing();
}

async function syncTask(
  database: Database,
  taskId: string,
  source: TaskDocumentSource,
  userId: string | null,
  texts: string[],
) {
  const [task] = await database
    .select({ workspaceId: projectTable.workspaceId })
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(eq(taskTable.id, taskId));
  const candidates = task
    ? [
        ...new Set(
          texts.flatMap((text) => findDocumentIds(text, task.workspaceId)),
        ),
      ]
    : [];
  // An address is a link only if the document is in the issue's workspace.
  const documents =
    task && candidates.length
      ? await database
          .select({ id: documentTable.id })
          .from(documentTable)
          .where(
            and(
              eq(documentTable.workspaceId, task.workspaceId),
              inArray(documentTable.id, candidates),
            ),
          )
      : [];
  await reconcile(
    database,
    source,
    { taskId },
    documents.map((document) => document.id),
    userId,
  );
}

/** The documents an issue's description links to. */
export const syncTaskDescriptionLinks = (
  database: Database,
  taskId: string,
  userId: string | null,
  description: string | null,
) => syncTask(database, taskId, "description", userId, [description ?? ""]);

/** The documents an issue's comments link to. Any comment can carry a link, so all are read. */
export async function syncTaskCommentLinks(
  database: Database,
  taskId: string,
  userId: string | null,
) {
  const comments = await database
    .select({ content: activityTable.content })
    .from(activityTable)
    .where(
      and(
        eq(activityTable.taskId, taskId),
        eq(activityTable.type, "comment"),
        like(activityTable.content, "%/document/%"),
      ),
    );
  await syncTask(
    database,
    taskId,
    "comment",
    userId,
    comments.map((comment) => comment.content ?? ""),
  );
}

/** The issues a document's text names. Called wherever document text is written. */
export async function syncDocumentTaskLinks(
  database: Database,
  document: { id: string; workspaceId: string },
  userId: string | null,
  content: string,
) {
  const { ids, keys } = findTaskReferences(content);
  const projects = keys.length
    ? await database
        .select({ id: projectTable.id, slug: projectTable.slug })
        .from(projectTable)
        .where(eq(projectTable.workspaceId, document.workspaceId))
    : [];
  const numbered = keys.flatMap(({ key, number }) => {
    const named = projects.filter((project) =>
      isSameProjectKey(project.slug, key),
    );
    // A key two teams answer to names neither.
    return named.length === 1 && named[0]
      ? [
          and(
            eq(taskTable.projectId, named[0].id),
            eq(taskTable.number, number),
          ),
        ]
      : [];
  });
  const tasks =
    ids.length || numbered.length
      ? await database
          .select({ id: taskTable.id })
          .from(taskTable)
          .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
          .where(
            and(
              eq(projectTable.workspaceId, document.workspaceId),
              or(
                ids.length ? inArray(taskTable.id, ids) : undefined,
                ...numbered,
              ),
            ),
          )
      : [];
  await reconcile(
    database,
    "document",
    { documentId: document.id },
    tasks.map((task) => task.id),
    userId,
  );
}
