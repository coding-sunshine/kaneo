import { and, eq, isNull } from "drizzle-orm";
import type db from "../../database";
import {
  documentTable,
  statementTable,
  topicSlotTable,
  userTable,
} from "../../database/schema";
import { documentVisibility } from "../../document/visibility";
import { forText } from "../statement-hash";

export type Reader = Pick<typeof db, "select">;

/**
 * What a topic states now: the confirmed statements of its current document,
 * written for the text that was approved. With a viewer, only when that
 * person can open the document.
 */
export function currentStatements(
  database: Reader,
  topicId: string,
  viewerId?: string,
) {
  return database
    .select({
      statementId: statementTable.id,
      slotId: statementTable.slotId,
      value: statementTable.value,
      normalized: statementTable.normalized,
      quote: statementTable.quote,
      documentId: documentTable.id,
      documentTitle: documentTable.title,
      approvedByName: userTable.name,
      approvedAt: documentTable.approvedAt,
    })
    .from(statementTable)
    .innerJoin(topicSlotTable, eq(topicSlotTable.id, statementTable.slotId))
    .innerJoin(documentTable, eq(documentTable.id, statementTable.documentId))
    .leftJoin(userTable, eq(userTable.id, documentTable.approvedBy))
    .where(
      and(
        eq(topicSlotTable.topicId, topicId),
        eq(documentTable.topicId, topicId),
        eq(documentTable.status, "current"),
        isNull(documentTable.deletedAt),
        eq(statementTable.status, "confirmed"),
        forText(documentTable.approvedHash),
        viewerId ? documentVisibility(viewerId, documentTable) : undefined,
      ),
    );
}
