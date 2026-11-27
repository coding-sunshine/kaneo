import { and, eq, inArray, isNull } from "drizzle-orm";
import db from "../../database";
import {
  statementDependencyTable,
  statementTable,
  topicTable,
} from "../../database/schema";
import { currentStatements, type Reader } from "./current-statements";

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Stated = Map<string, string>;

// What a topic states now: for each slot, its value in the compared form.
async function statedBy(database: Reader, topicId: string): Promise<Stated> {
  const rows = await currentStatements(database, topicId);
  return new Map(rows.map((row) => [row.slotId, row.normalized]));
}

/**
 * Runs a change to what a topic states: a new current document, one set
 * aside, or a decision on a statement. One such change at a time on a topic;
 * the `one_current` index is the backstop for approvals. Work that relied on
 * a value the topic no longer states is flagged in the same transaction.
 */
export function changingTopic<T>(
  topicId: string,
  change: (tx: Transaction) => PromiseLike<T>,
) {
  return db.transaction(async (tx) => {
    await tx
      .select({ id: topicTable.id })
      .from(topicTable)
      .where(eq(topicTable.id, topicId))
      .for("no key update");
    const before = await statedBy(tx, topicId);
    const result = await change(tx);
    await flagDependents(tx, topicId, before);
    return result;
  });
}

// A dependency is stale when its slot's value changed and the topic no longer
// states the value it relied on. A document that relies on such a value may be
// relied on itself, so the flag follows those links and keeps the first
// statement as its cause. A flag nobody cleared stays as it is.
async function flagDependents(
  tx: Transaction,
  topicId: string,
  before: Stated,
) {
  const after = await statedBy(tx, topicId);
  const changed = [...new Set([...before.keys(), ...after.keys()])].filter(
    (slot) => before.get(slot) !== after.get(slot),
  );
  if (changed.length === 0) return;
  const relying = await tx
    .select({
      id: statementDependencyTable.id,
      documentId: statementDependencyTable.documentId,
      statementId: statementDependencyTable.statementId,
      slotId: statementTable.slotId,
      normalized: statementTable.normalized,
    })
    .from(statementDependencyTable)
    .innerJoin(
      statementTable,
      eq(statementTable.id, statementDependencyTable.statementId),
    )
    .where(inArray(statementTable.slotId, changed));
  let wave = relying
    .filter((row) => row.normalized !== after.get(row.slotId))
    .map((row) => ({
      id: row.id,
      documentId: row.documentId,
      cause: row.statementId,
    }));
  const now = new Date();
  const followed = new Set<string>();
  while (wave.length > 0) {
    const byCause = new Map<string, string[]>();
    const documents = new Map<string, string>();
    for (const { id, documentId, cause } of wave) {
      byCause.set(cause, [...(byCause.get(cause) ?? []), id]);
      if (documentId && !followed.has(documentId)) {
        followed.add(documentId);
        documents.set(documentId, cause);
      }
    }
    for (const [cause, ids] of byCause) {
      await tx
        .update(statementDependencyTable)
        .set({ needsReviewAt: now, causeStatementId: cause })
        .where(
          and(
            inArray(statementDependencyTable.id, ids),
            isNull(statementDependencyTable.needsReviewAt),
          ),
        );
    }
    if (documents.size === 0) return;
    const next = await tx
      .select({
        id: statementDependencyTable.id,
        documentId: statementDependencyTable.documentId,
        reliesOn: statementTable.documentId,
      })
      .from(statementDependencyTable)
      .innerJoin(
        statementTable,
        eq(statementTable.id, statementDependencyTable.statementId),
      )
      .where(inArray(statementTable.documentId, [...documents.keys()]));
    wave = next.map((row) => ({
      id: row.id,
      documentId: row.documentId,
      cause: documents.get(row.reliesOn) ?? "",
    }));
  }
}
