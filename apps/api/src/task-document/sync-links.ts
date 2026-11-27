import { and, eq, inArray, like, notInArray } from "drizzle-orm";
import db from "../database";
import {
  activityTable,
  documentTable,
  projectTable,
  type TaskDocumentSource,
  taskDocumentTable,
  taskTable,
} from "../database/schema";
import { documentTeamAccess } from "../document/visibility";
import { publishEvent } from "../events";
import { findDocumentIds, findTaskReferences } from "./find-links";
import { resolveTaskReferences } from "./resolve-tasks";

type Database = Pick<typeof db, "select" | "insert" | "delete">;

/** The links of `taskIds` to `documentIds` were added or dropped. */
export type LinkChange = {
  workspaceId: string;
  taskIds: string[];
  documentIds: string[];
};

// Makes the rows of one place match its text. A link that is gone loses its
// row, a new link gets one, and a row that stays keeps who made it and what
// it grants. Whoever saves the text need not be able to open the other side:
// a row lets nobody into anything.
// Open pages hear of a change, but only outside a transaction: inside one
// they would read the rows before they are committed. A new issue is
// announced by its own event once its transaction commits.
async function reconcile(
  database: Database,
  workspaceId: string,
  source: TaskDocumentSource,
  anchor: { taskId: string } | { documentId: string },
  others: string[],
  userId: string | null,
  prune = true,
) {
  const [own, other, id] =
    "taskId" in anchor
      ? [taskDocumentTable.taskId, taskDocumentTable.documentId, anchor.taskId]
      : [
          taskDocumentTable.documentId,
          taskDocumentTable.taskId,
          anchor.documentId,
        ];
  const dropped = prune
    ? await database
        .delete(taskDocumentTable)
        .where(
          and(
            eq(own, id),
            eq(taskDocumentTable.source, source),
            others.length ? notInArray(other, others) : undefined,
          ),
        )
        .returning({ id: other })
    : [];
  const added = others.length
    ? await database
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
        .onConflictDoNothing()
        .returning({ id: other })
    : [];
  const changed = [...new Set([...dropped, ...added].map((row) => row.id))];
  if (!changed.length || database !== db) return;
  const change: LinkChange =
    "taskId" in anchor
      ? { workspaceId, taskIds: [id], documentIds: changed }
      : { workspaceId, taskIds: changed, documentIds: [id] };
  await publishEvent("task_document.links_changed", change);
}

async function syncTask(
  database: Database,
  taskId: string,
  source: TaskDocumentSource,
  userId: string | null,
  texts: string[],
  prune = true,
) {
  const [task] = await database
    .select({
      workspaceId: projectTable.workspaceId,
      teamId: taskTable.projectId,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(eq(taskTable.id, taskId));
  if (!task) return;
  const candidates = [
    ...new Set(
      texts.flatMap((text) => findDocumentIds(text, task.workspaceId)),
    ),
  ];
  // An address is a link only if the document is in the issue's workspace.
  // Text with no author, such as an integration's, links only what the
  // issue's team can open, so it never records a closed team's document.
  const documents = candidates.length
    ? await database
        .select({ id: documentTable.id })
        .from(documentTable)
        .where(
          and(
            eq(documentTable.workspaceId, task.workspaceId),
            inArray(documentTable.id, candidates),
            userId === null
              ? documentTeamAccess(task.teamId, documentTable)
              : undefined,
          ),
        )
    : [];
  await reconcile(
    database,
    task.workspaceId,
    source,
    { taskId },
    documents.map((document) => document.id),
    userId,
    prune,
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
  // Without an author only the team's documents are found, so a link that
  // a member wrote to a closed team's document must stay: add, never drop.
  await syncTask(
    database,
    taskId,
    "comment",
    userId,
    comments.map((comment) => comment.content ?? ""),
    userId !== null,
  );
}

/** The issues a document's text names. Called wherever document text is written. */
export async function syncDocumentTaskLinks(
  database: Database,
  document: { id: string; workspaceId: string },
  userId: string | null,
  content: string,
) {
  const tasks = await resolveTaskReferences(
    database,
    document.workspaceId,
    findTaskReferences(content),
  );
  await reconcile(
    database,
    document.workspaceId,
    "document",
    { documentId: document.id },
    tasks,
    userId,
  );
}
