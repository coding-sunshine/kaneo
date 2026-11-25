import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { statementDependencyTable } from "../../database/schema";
import { loadDocument } from "../../document/controllers/load-document";
import { loadTask } from "../../document/controllers/share-with-task";
import { currentStatements } from "./current-statements";
import { statementOf } from "./statements";

type Work = { taskId?: string | null; documentId?: string | null };
type Row = typeof statementDependencyTable.$inferSelect;

const shown = (row: Row) => ({
  id: row.id,
  statementId: row.statementId,
  taskId: row.taskId,
  documentId: row.documentId,
  needsReview: row.needsReviewAt !== null,
});

// The issue or document a dependency names, for someone who can open it.
const openWork = (workspaceId: string, work: Work, userId: string) =>
  work.taskId
    ? loadTask(workspaceId, work.taskId, userId)
    : loadDocument(workspaceId, work.documentId ?? "", userId);

/**
 * Records that an issue or a document relies on a value its topic states now.
 * Needs view access to the statement's document and to the work. Saying it
 * twice keeps the one link.
 */
export async function addDependency(
  workspaceId: string,
  documentId: string,
  statementId: string,
  userId: string,
  work: Work,
) {
  const doc = await loadDocument(workspaceId, documentId, userId);
  const { statement, topicId } = await statementOf(doc, statementId, userId);
  const stated = await currentStatements(db, topicId);
  if (!stated.some((row) => row.statementId === statement.id)) {
    throw new HTTPException(409, {
      message: "Only a value the topic states now can be relied on",
    });
  }
  if (work.documentId === doc.id) {
    throw new HTTPException(400, {
      message: "A document cannot rely on its own statement",
    });
  }
  const { id } = await openWork(workspaceId, work, userId);
  const target = work.taskId ? { taskId: id } : { documentId: id };
  const [made] = await db
    .insert(statementDependencyTable)
    .values({ statementId: statement.id, createdBy: userId, ...target })
    .onConflictDoNothing()
    .returning();
  const [row] = made
    ? [made]
    : await db
        .select()
        .from(statementDependencyTable)
        .where(
          and(
            eq(statementDependencyTable.statementId, statement.id),
            work.taskId
              ? eq(statementDependencyTable.taskId, id)
              : eq(statementDependencyTable.documentId, id),
          ),
        );
  if (!row) {
    throw new HTTPException(409, {
      message: "The dependency was removed meanwhile. Send it again",
    });
  }
  return shown(row);
}

export async function removeDependency(
  workspaceId: string,
  documentId: string,
  statementId: string,
  dependencyId: string,
  userId: string,
) {
  const missing = new HTTPException(404, { message: "Dependency not found" });
  const doc = await loadDocument(workspaceId, documentId, userId);
  const { statement } = await statementOf(doc, statementId, userId);
  const [row] = await db
    .select()
    .from(statementDependencyTable)
    .where(
      and(
        eq(statementDependencyTable.id, dependencyId),
        eq(statementDependencyTable.statementId, statement.id),
      ),
    );
  if (!row) throw missing;
  // A link to work the user cannot open looks like no link.
  await openWork(workspaceId, row, userId).catch((error) => {
    throw error instanceof HTTPException && error.status === 404
      ? missing
      : error;
  });
  await db
    .delete(statementDependencyTable)
    .where(eq(statementDependencyTable.id, row.id));
  return { id: row.id };
}
