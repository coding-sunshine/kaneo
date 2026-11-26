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
import { getTopic } from "./get-topic";

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

// The issue or the document that relies on a statement.
const work = {
  taskId: taskTable.id,
  taskTitle: taskTable.title,
  taskNumber: taskTable.number,
  projectId: projectTable.id,
  projectSlug: projectTable.slug,
  workDocumentId: workDocument.id,
  workDocumentTitle: workDocument.title,
};
type Work = { [K in keyof typeof work]: string | number | null };

const workOf = (row: Work) => ({
  task: row.taskId
    ? {
        id: String(row.taskId),
        title: String(row.taskTitle ?? ""),
        number: Number(row.taskNumber),
        projectId: String(row.projectId),
        projectSlug: String(row.projectSlug ?? ""),
      }
    : null,
  document: row.workDocumentId
    ? {
        id: String(row.workDocumentId),
        title: String(row.workDocumentTitle ?? ""),
      }
    : null,
});

// Work the reader can open: an issue of a team they are in, or a document
// they can read that is not in the trash.
const workVisible = (workspaceId: string, userId: string) =>
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
  );

/**
 * Flagged work, for someone who can open the work and the document whose
 * statement it relies on. Anything else is left out in the query, so a hidden
 * one cannot be counted either. The statement whose change raised the flag
 * may sit further up a chain, in a place the reader cannot open: the flag
 * still shows, so the work can be looked at and cleared, and `causeVisible`
 * says whether the cause may be named. A replaced document that sits in the
 * trash still explains its flag to the people who could open it.
 */
function flagged(workspaceId: string, userId: string, id?: string) {
  return db
    .select({
      id: dependency.id,
      // Never null here: the query keeps only flagged rows.
      flaggedAt: sql`${dependency.needsReviewAt}`.mapWith(
        dependency.needsReviewAt,
      ),
      ...work,
      causeVisible: sql<boolean>`(
        ${documentVisibility(userId, causeDocument)}
        AND ${topicAccess(userId, causeSlot.topicId)}
      )`,
      dependsOn: {
        statementId: reliedOn.id,
        slot: reliedSlot.key,
        slotName: reliedSlot.name,
        value: reliedOn.value,
        quote: reliedOn.quote,
        documentId: reliedDocument.id,
        documentTitle: reliedDocument.title,
        topicId: reliedSlot.topicId,
      },
      cause: {
        statementId: cause.id,
        slot: causeSlot.key,
        slotName: causeSlot.name,
        value: cause.value,
        quote: cause.quote,
        documentId: causeDocument.id,
        documentTitle: causeDocument.title,
        topicId: causeSlot.topicId,
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
        workVisible(workspaceId, userId),
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
      ...workOf(row),
      dependsOn: row.dependsOn,
      cause: row.causeVisible ? row.cause : null,
    })),
  };
}

/**
 * The work that relies on a value one of the topic's documents states, for
 * someone who can open the topic, that document and the work. A link to a
 * replaced document stays listed: that is the work a change flagged.
 */
export async function listDependents(
  workspaceId: string,
  topicId: string,
  userId: string,
) {
  await getTopic(workspaceId, topicId, userId);
  const rows = await db
    .select({
      id: dependency.id,
      statementId: reliedOn.id,
      slot: reliedSlot.key,
      slotName: reliedSlot.name,
      value: reliedOn.value,
      statedIn: reliedOn.documentId,
      needsReview: sql<boolean>`${dependency.needsReviewAt} IS NOT NULL`,
      ...work,
    })
    .from(dependency)
    .innerJoin(reliedOn, eq(reliedOn.id, dependency.statementId))
    .innerJoin(reliedSlot, eq(reliedSlot.id, reliedOn.slotId))
    .innerJoin(reliedDocument, eq(reliedDocument.id, reliedOn.documentId))
    .leftJoin(taskTable, eq(taskTable.id, dependency.taskId))
    .leftJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .leftJoin(workDocument, eq(workDocument.id, dependency.documentId))
    .where(
      and(
        eq(reliedSlot.topicId, topicId),
        eq(reliedDocument.workspaceId, workspaceId),
        documentVisibility(userId, reliedDocument),
        workVisible(workspaceId, userId),
      ),
    )
    .orderBy(reliedSlot.name, dependency.id);
  return {
    items: rows.map(
      ({
        id,
        statementId,
        slot,
        slotName,
        value,
        statedIn,
        needsReview,
        ...on
      }) => ({
        id,
        statementId,
        slot,
        slotName,
        value,
        statedIn,
        needsReview,
        ...workOf(on),
      }),
    ),
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
