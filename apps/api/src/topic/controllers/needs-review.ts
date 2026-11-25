import { and, desc, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  documentTable,
  projectTable,
  statementDependencyTable,
  statementTable,
  taskTable,
  topicSlotTable,
} from "../../database/schema";
import { documentVisibility, topicAccess } from "../../document/visibility";
import { projectAccessCondition } from "../../project-access/project-access-condition";

const dependency = statementDependencyTable;
// The statement the work relies on, and the one whose change raised the flag.
// They differ when the flag came down a chain of documents.
const reliedOn = alias(statementTable, "relied_on");
const reliedSlot = alias(topicSlotTable, "relied_slot");
const reliedDocument = alias(documentTable, "relied_document");
const cause = alias(statementTable, "cause");
const causeSlot = alias(topicSlotTable, "cause_slot");
const causeDocument = alias(documentTable, "cause_document");
const workDocument = alias(documentTable, "work_document");

/**
 * Flagged work, for someone who can open all three: the work, the document
 * whose statement it relies on, and the document whose change raised the
 * flag. Anything else is left out in the query, so a hidden one cannot be
 * counted either. A replaced document that sits in the trash still explains
 * its flag to the people who could open it.
 */
function flagged(workspaceId: string, userId: string, id?: string) {
  return db
    .select({
      id: dependency.id,
      // Never null here: the query keeps only flagged rows.
      flaggedAt: sql`${dependency.needsReviewAt}`.mapWith(
        dependency.needsReviewAt,
      ),
      taskId: taskTable.id,
      taskTitle: taskTable.title,
      workDocumentId: workDocument.id,
      workDocumentTitle: workDocument.title,
      dependsOn: {
        statementId: reliedOn.id,
        slot: reliedSlot.key,
        slotName: reliedSlot.name,
        value: reliedOn.value,
        quote: reliedOn.quote,
        documentId: reliedDocument.id,
        documentTitle: reliedDocument.title,
      },
      cause: {
        statementId: cause.id,
        slot: causeSlot.key,
        slotName: causeSlot.name,
        value: cause.value,
        quote: cause.quote,
        documentId: causeDocument.id,
        documentTitle: causeDocument.title,
      },
    })
    .from(dependency)
    .innerJoin(reliedOn, eq(reliedOn.id, dependency.statementId))
    .innerJoin(reliedSlot, eq(reliedSlot.id, reliedOn.slotId))
    .innerJoin(reliedDocument, eq(reliedDocument.id, reliedOn.documentId))
    .innerJoin(
      cause,
      eq(
        cause.id,
        sql`coalesce(${dependency.causeStatementId}, ${dependency.statementId})`,
      ),
    )
    .innerJoin(causeSlot, eq(causeSlot.id, cause.slotId))
    .innerJoin(causeDocument, eq(causeDocument.id, cause.documentId))
    .leftJoin(taskTable, eq(taskTable.id, dependency.taskId))
    .leftJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .leftJoin(workDocument, eq(workDocument.id, dependency.documentId))
    .where(
      and(
        id ? eq(dependency.id, id) : undefined,
        isNotNull(dependency.needsReviewAt),
        eq(reliedDocument.workspaceId, workspaceId),
        documentVisibility(userId, reliedDocument),
        topicAccess(userId, reliedSlot.topicId),
        documentVisibility(userId, causeDocument),
        topicAccess(userId, causeSlot.topicId),
        or(
          and(
            eq(projectTable.workspaceId, workspaceId),
            projectAccessCondition(userId, projectTable.id),
          ),
          and(
            eq(workDocument.workspaceId, workspaceId),
            isNull(workDocument.deletedAt),
            documentVisibility(userId, workDocument),
          ),
        ),
      ),
    )
    .orderBy(desc(dependency.needsReviewAt), dependency.id);
}

// ponytail: no paging. Add it when a workspace keeps hundreds of open flags.
export async function listNeedsReview(workspaceId: string, userId: string) {
  const rows = await flagged(workspaceId, userId);
  return {
    items: rows.map((row) => ({
      id: row.id,
      flaggedAt: row.flaggedAt,
      task: row.taskId ? { id: row.taskId, title: row.taskTitle ?? "" } : null,
      document: row.workDocumentId
        ? { id: row.workDocumentId, title: row.workDocumentTitle ?? "" }
        : null,
      dependsOn: row.dependsOn,
      cause: row.cause,
    })),
  };
}

/** Someone looked at the work. The link stays, and a later change flags it again. */
export async function clearFlag(
  workspaceId: string,
  dependencyId: string,
  userId: string,
) {
  const [row] = await flagged(workspaceId, userId, dependencyId);
  if (!row) {
    throw new HTTPException(404, {
      message: "Nothing to review under this id",
    });
  }
  await db
    .update(dependency)
    .set({ needsReviewAt: null, causeStatementId: null })
    .where(eq(dependency.id, row.id));
  return { id: row.id, needsReview: false };
}
