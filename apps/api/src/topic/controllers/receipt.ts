import { createHash } from "node:crypto";
import { and, asc, eq, ne } from "drizzle-orm";
import db from "../../database";
import {
  type SlotType,
  statementConflictTable,
  statementTable,
  topicSlotTable,
} from "../../database/schema";
import { loadDocument } from "../../document/controllers/load-document";
import { currentStatements, type Reader } from "./current-statements";
import { judgementsOf, textsHash } from "./judgement";
import { openTopic } from "./statements";

type Text = { id: string; contentHash: string | null };
type Decision = typeof statementConflictTable.$inferSelect;

type Stated = {
  statementId: string;
  slotId: string;
  slot: string;
  slotName: string;
  type: SlotType;
  value: string;
  quote: string;
  confirmed: boolean;
};
type Compared = Stated & {
  current: {
    statementId: string;
    documentId: string;
    documentTitle: string;
    value: string;
    quote: string;
  };
};

// A value can hold any character, so the parts are joined as JSON.
const pairHash = (...parts: string[]) =>
  createHash("sha256").update(JSON.stringify(parts)).digest("hex");

// Only two decisions hold a conflict back: the document's value stands, or
// the two may differ until a date that has not come yet.
function standing(decision: Decision | undefined) {
  if (decision?.decision === "replace") {
    return {
      status: "resolved" as const,
      reason: decision.reason,
      tolerateUntil: null,
    };
  }
  if (decision?.tolerateUntil && decision.tolerateUntil > new Date()) {
    return {
      status: "tolerated" as const,
      reason: decision.reason,
      tolerateUntil: decision.tolerateUntil,
    };
  }
  return { status: "open" as const, reason: null, tolerateUntil: null };
}

/**
 * What a document states for its topic's slots, sorted against what the topic
 * states now, as `viewerId` may see it. A current document the viewer cannot
 * open counts as none, so its statements never show through a comparison.
 */
export async function receiptOf(
  database: Reader,
  doc: Text,
  topicId: string,
  viewerId: string,
) {
  const slots = await database
    .select()
    .from(topicSlotTable)
    .where(eq(topicSlotTable.topicId, topicId))
    .orderBy(asc(topicSlotTable.key));
  const stated = new Map(
    (
      await database
        .select()
        .from(statementTable)
        .where(
          and(
            eq(statementTable.documentId, doc.id),
            eq(statementTable.contentHash, doc.contentHash ?? ""),
            ne(statementTable.status, "rejected"),
          ),
        )
    ).map((statement) => [statement.slotId, statement]),
  );
  const current = new Map(
    (await currentStatements(database, topicId, viewerId)).map((statement) => [
      statement.slotId,
      statement,
    ]),
  );
  const decisions = new Map(
    (
      await database
        .select()
        .from(statementConflictTable)
        .where(eq(statementConflictTable.documentId, doc.id))
    ).map((decision) => [decision.pairHash, decision]),
  );

  // Free text: whether two wordings disagree is a judgement, not a
  // comparison. Only pairs this viewer sees are looked up.
  const judged = await judgementsOf(
    database,
    slots.flatMap((slot) => {
      const statement = stated.get(slot.id);
      const against = current.get(slot.id);
      return slot.type === "term" &&
        statement &&
        against &&
        statement.normalized !== against.normalized
        ? [textsHash({ ...statement, slotName: slot.name, current: against })]
        : [];
    }),
  );

  const receipt = {
    repeats: [] as Compared[],
    new: [] as Stated[],
    conflicts: [] as (Compared & { id: string } & ReturnType<
        typeof standing
      >)[],
    unjudged: [] as Compared[],
    notChecked: [] as { slot: string; slotName: string; type: SlotType }[],
  };
  for (const slot of slots) {
    const statement = stated.get(slot.id);
    if (!statement) {
      receipt.notChecked.push({
        slot: slot.key,
        slotName: slot.name,
        type: slot.type,
      });
      continue;
    }
    const head = {
      statementId: statement.id,
      slotId: slot.id,
      slot: slot.key,
      slotName: slot.name,
      type: slot.type,
      value: statement.value,
      quote: statement.quote,
      confirmed: statement.status === "confirmed",
    };
    const against = current.get(slot.id);
    if (!against) {
      receipt.new.push(head);
      continue;
    }
    const compared = {
      ...head,
      current: {
        statementId: against.statementId,
        documentId: against.documentId,
        documentTitle: against.documentTitle,
        value: against.value,
        quote: against.quote,
      },
    };
    // What the model said about two wordings. Until it said something, the
    // pair holds nothing back.
    const contradicts =
      slot.type === "term" ? judged.get(textsHash(compared)) : true;
    if (against.normalized === statement.normalized || contradicts === false) {
      receipt.repeats.push(compared);
    } else if (!contradicts) {
      receipt.unjudged.push(compared);
    } else {
      const id = pairHash(
        slot.id,
        doc.id,
        statement.normalized,
        against.documentId,
        against.normalized,
      );
      receipt.conflicts.push({
        ...compared,
        id,
        ...standing(decisions.get(id)),
      });
    }
  }
  return receipt;
}

export async function getReceipt(
  workspaceId: string,
  documentId: string,
  userId: string,
) {
  const doc = await loadDocument(workspaceId, documentId, userId);
  // To someone who cannot open the topic, the document is on no topic.
  const topicId = await openTopic(doc, userId);
  if (!topicId) {
    return {
      repeats: [],
      new: [],
      conflicts: [],
      unjudged: [],
      notChecked: [],
    };
  }
  return receiptOf(db, doc, topicId, userId);
}
