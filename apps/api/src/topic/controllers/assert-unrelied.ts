import { and, eq, isNotNull, isNull, ne, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  documentTable,
  statementDependencyTable,
  statementTable,
  taskTable,
  topicSlotTable,
  topicTable,
} from "../../database/schema";

type Owner = { projectId: string } | { workProjectId: string };

const stating = alias(documentTable, "stating_document");
const relying = alias(documentTable, "relying_document");

/**
 * Deleting a team or a work project removes its topics and documents, and
 * with them every statement of theirs. Work that stays, and relies on one of
 * those statements, would lose its link without a flag, so those links have
 * to go first. An issue or a document of the team goes with it.
 */
export async function assertUnrelied(owner: Owner) {
  // ponytail: a link made in the same instant still goes with the team. Lock
  // the topics here if that ever happens.
  const ownedBy =
    "projectId" in owner
      ? (table: typeof topicTable | typeof stating | typeof relying) =>
          eq(table.projectId, owner.projectId)
      : (table: typeof topicTable | typeof stating | typeof relying) =>
          eq(table.workProjectId, owner.workProjectId);
  const taskStays =
    "projectId" in owner ? ne(taskTable.projectId, owner.projectId) : undefined;
  const documentStays =
    "projectId" in owner
      ? or(isNull(relying.projectId), ne(relying.projectId, owner.projectId))
      : or(
          isNull(relying.workProjectId),
          ne(relying.workProjectId, owner.workProjectId),
        );
  const [reliedOn] = await db
    .select({ id: statementDependencyTable.id })
    .from(statementDependencyTable)
    .innerJoin(
      statementTable,
      eq(statementTable.id, statementDependencyTable.statementId),
    )
    .innerJoin(topicSlotTable, eq(topicSlotTable.id, statementTable.slotId))
    .innerJoin(topicTable, eq(topicTable.id, topicSlotTable.topicId))
    .innerJoin(stating, eq(stating.id, statementTable.documentId))
    .leftJoin(taskTable, eq(taskTable.id, statementDependencyTable.taskId))
    .leftJoin(relying, eq(relying.id, statementDependencyTable.documentId))
    .where(
      and(
        or(ownedBy(topicTable), ownedBy(stating)),
        or(
          and(isNotNull(statementDependencyTable.taskId), taskStays),
          and(isNotNull(statementDependencyTable.documentId), documentStays),
        ),
      ),
    )
    .limit(1);
  if (reliedOn) {
    throw new HTTPException(409, {
      message:
        "Work elsewhere relies on facts of this project's topics or documents. Remove those links first",
    });
  }
}
