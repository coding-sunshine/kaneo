import { and, asc, eq, inArray, isNotNull, isNull, ne, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { HTTPException } from "hono/http-exception";
import {
  documentTable,
  statementDependencyTable,
  statementTable,
  taskTable,
  topicSlotTable,
  topicTable,
} from "../../database/schema";
import type { Transaction } from "./flag-dependents";

type Owner = { projectId: string } | { workProjectId: string };

const stating = alias(documentTable, "stating_document");
const relying = alias(documentTable, "relying_document");

type Place =
  | typeof topicTable
  | typeof documentTable
  | typeof stating
  | typeof relying;

/**
 * Deleting a team or a work project removes its topics and documents, and
 * with them every statement of theirs. Work that stays, and relies on one of
 * those statements, would lose its link without a flag, so those links have
 * to go first. An issue or a document of the team goes with it. Runs in the
 * delete's transaction: it locks the topics those statements are on, before
 * anything else, so a link written meanwhile waits and is then refused.
 */
export async function assertUnrelied(tx: Transaction, owner: Owner) {
  const ownedBy =
    "projectId" in owner
      ? (table: Place) => eq(table.projectId, owner.projectId)
      : (table: Place) => eq(table.workProjectId, owner.workProjectId);
  // The team's topics, and the topics its documents are filed on. A link
  // holds a share lock on its topic, as every topic path takes the topic
  // first.
  await tx
    .select({ id: topicTable.id })
    .from(topicTable)
    .where(
      or(
        ownedBy(topicTable),
        inArray(
          topicTable.id,
          tx
            .select({ id: documentTable.topicId })
            .from(documentTable)
            .where(ownedBy(documentTable)),
        ),
      ),
    )
    .orderBy(asc(topicTable.id))
    .for("update");
  const taskStays =
    "projectId" in owner ? ne(taskTable.projectId, owner.projectId) : undefined;
  const documentStays =
    "projectId" in owner
      ? or(isNull(relying.projectId), ne(relying.projectId, owner.projectId))
      : or(
          isNull(relying.workProjectId),
          ne(relying.workProjectId, owner.workProjectId),
        );
  const [reliedOn] = await tx
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
