import { and, asc, eq, isNull, ne } from "drizzle-orm";
import db from "../../database";
import {
  documentTable,
  statementTable,
  topicSlotTable,
} from "../../database/schema";
import { documentVisibility } from "../../document/visibility";
import { currentStatements } from "./current-statements";
import type { Slot } from "./slots";
import { forText } from "../statement-hash";

/**
 * What a topic states for each of its slots, as `viewerId` may see it: the
 * confirmed statement of the current document, with the quote it rests on
 * and who approved it. A slot nobody approved a value for answers null.
 * Documents that wait for a decision are named and never quoted: a value
 * nobody approved is not something to answer from.
 */
export async function answersOf(
  topicId: string,
  slots: Slot[],
  viewerId: string,
  only?: string,
) {
  const wanted = slots.filter((slot) => !only || slot.key === only);
  if (wanted.length === 0) return [];
  const current = new Map(
    (await currentStatements(db, topicId, viewerId)).map((statement) => [
      statement.slotId,
      statement,
    ]),
  );
  const waiting = await db
    .selectDistinct({
      slotId: statementTable.slotId,
      id: documentTable.id,
      title: documentTable.title,
    })
    .from(statementTable)
    .innerJoin(topicSlotTable, eq(topicSlotTable.id, statementTable.slotId))
    .innerJoin(documentTable, eq(documentTable.id, statementTable.documentId))
    .where(
      and(
        eq(topicSlotTable.topicId, topicId),
        eq(documentTable.topicId, topicId),
        eq(documentTable.status, "in_review"),
        isNull(documentTable.deletedAt),
        ne(statementTable.status, "rejected"),
        forText(documentTable.contentHash),
        documentVisibility(viewerId, documentTable),
      ),
    )
    .orderBy(asc(documentTable.title), asc(documentTable.id));
  return wanted.map((slot) => {
    const stated = current.get(slot.id);
    return {
      slot: slot.key,
      slotName: slot.name,
      type: slot.type,
      statementId: stated?.statementId ?? null,
      value: stated?.value ?? null,
      quote: stated?.quote ?? null,
      documentId: stated?.documentId ?? null,
      documentTitle: stated?.documentTitle ?? null,
      approvedByName: stated?.approvedByName ?? null,
      approvedAt: stated?.approvedAt ?? null,
      proposedIn: waiting
        .filter((doc) => doc.slotId === slot.id)
        .map(({ id, title }) => ({ id, title })),
    };
  });
}
