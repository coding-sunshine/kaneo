import { and, asc, eq, ne } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  type StatementResult,
  type StatementSource,
  statementTable,
  topicSlotTable,
  topicTable,
  userTable,
} from "../../database/schema";
import { loadDocument } from "../../document/controllers/load-document";
import { topicAccess } from "../../document/visibility";
import { collapse, documentText, quoteStart } from "../statement-text";
import { normalizeValue } from "../statement-value";
import { changingTopic } from "./flag-dependents";
import { getTopic } from "./get-topic";
import { type Slot, slotsOf } from "./slots";

export type SentStatement = { slot: string; value: string; quote: string };
// `contentHash` is written by a database trigger, so its column is nullable.
type Text = { id: string; content: string; contentHash: string | null };
type Loaded = Awaited<ReturnType<typeof loadDocument>>;

const columns = {
  id: statementTable.id,
  slotId: statementTable.slotId,
  slot: topicSlotTable.key,
  slotName: topicSlotTable.name,
  type: topicSlotTable.type,
  value: statementTable.value,
  quote: statementTable.quote,
  quoteStart: statementTable.quoteStart,
  status: statementTable.status,
  statusReason: statementTable.statusReason,
  source: statementTable.source,
  createdAt: statementTable.createdAt,
  decidedAt: statementTable.decidedAt,
  decidedByName: userTable.name,
};

const shown = () =>
  db
    .select(columns)
    .from(statementTable)
    .innerJoin(topicSlotTable, eq(topicSlotTable.id, statementTable.slotId))
    .leftJoin(userTable, eq(userTable.id, statementTable.decidedBy));

async function one(id: string) {
  const [statement] = await shown().where(eq(statementTable.id, id));
  if (!statement) throw notFound();
  return statement;
}

const notFound = () =>
  new HTTPException(404, { message: "Statement not found" });

/**
 * Writes statements for the present text of a document that is filed on the
 * slots' topic. Each one is checked on its own and none fails the others: the
 * slot must be the topic's, the quote must be in the text and the value must
 * fit the slot. A slot keeps the statement it has, unless `replace` is set and
 * nobody confirmed it.
 */
export async function proposeStatements(
  doc: Text,
  slots: Slot[],
  sent: SentStatement[],
  source: StatementSource,
  userId: string | null,
  replace = false,
) {
  const text = documentText(doc.content);
  const contentHash = doc.contentHash ?? "";
  const results: { slot: string; result: StatementResult; id?: string }[] = [];
  for (const statement of sent) {
    const slot = slots.find((candidate) => candidate.key === statement.slot);
    const start = quoteStart(text, statement.quote);
    const normalized =
      slot && normalizeValue(slot.type, statement.value, slot.options);
    if (!slot) {
      results.push({ slot: statement.slot, result: "unknown_slot" });
      continue;
    }
    if (start < 0) {
      results.push({ slot: slot.key, result: "quote_not_found" });
      continue;
    }
    if (!normalized) {
      results.push({ slot: slot.key, result: "invalid_value" });
      continue;
    }
    const values = {
      value: collapse(statement.value),
      normalized,
      quote: collapse(statement.quote),
      quoteStart: start,
      source,
      createdBy: userId,
    };
    const [existing] = await db
      .select({ id: statementTable.id, status: statementTable.status })
      .from(statementTable)
      .where(
        and(
          eq(statementTable.slotId, slot.id),
          eq(statementTable.documentId, doc.id),
          eq(statementTable.contentHash, contentHash),
          ne(statementTable.status, "rejected"),
        ),
      );
    if (existing && (!replace || existing.status === "confirmed")) {
      results.push({ slot: slot.key, result: "exists", id: existing.id });
      continue;
    }
    if (existing) {
      await db
        .update(statementTable)
        .set(values)
        .where(eq(statementTable.id, existing.id));
      results.push({ slot: slot.key, result: "added", id: existing.id });
      continue;
    }
    const [added] = await db
      .insert(statementTable)
      .values({
        ...values,
        slotId: slot.id,
        documentId: doc.id,
        contentHash,
      })
      // Two writers at once: the slot keeps the first statement.
      .onConflictDoNothing()
      .returning({ id: statementTable.id });
    results.push({
      slot: slot.key,
      result: added ? "added" : "exists",
      id: added?.id,
    });
  }
  return results;
}

/**
 * When a document's text changes, the statements of the old text whose quote
 * is still in the new text are written again for it, as proposals. A
 * confirmation is for one text: the words around a quote can turn its
 * meaning, so a person confirms again. The old rows stay, because the answer
 * of a current document is read from the text that was approved.
 */
export async function carryStatements(
  documentId: string,
  fromHash: string | null,
  toHash: string | null,
  content: string,
) {
  if (!fromHash || !toHash || fromHash === toHash) return;
  const previous = await db
    .select()
    .from(statementTable)
    .where(
      and(
        eq(statementTable.documentId, documentId),
        eq(statementTable.contentHash, fromHash),
        ne(statementTable.status, "rejected"),
      ),
    );
  const text = documentText(content);
  const carried = previous.flatMap((statement) => {
    const start = text.indexOf(statement.quote);
    return start < 0
      ? []
      : [
          {
            slotId: statement.slotId,
            documentId,
            value: statement.value,
            normalized: statement.normalized,
            quote: statement.quote,
            quoteStart: start,
            contentHash: toHash,
            source: statement.source,
            createdBy: statement.createdBy,
          },
        ];
  });
  if (carried.length === 0) return;
  // The text may be one the document had before, with its own statements.
  await db.insert(statementTable).values(carried).onConflictDoNothing();
}

// A share opens the document, not the topic it is filed on. To someone who
// cannot open the topic, the document is on no topic: it has no slots and no
// statements, and a slot's name is never shown. A statement written while the
// document was on another topic stays with that topic's slot: it is not
// shown, confirmed or rejected from here.
export async function openTopic(doc: Loaded, userId: string) {
  if (!doc.topicId) return null;
  const [topic] = await db
    .select({ id: topicTable.id })
    .from(topicTable)
    .where(
      and(eq(topicTable.id, doc.topicId), topicAccess(userId, topicTable.id)),
    );
  return topic?.id ?? null;
}

/** The statements written for the document's present text. */
export async function listStatements(
  workspaceId: string,
  documentId: string,
  userId: string,
) {
  const doc = await loadDocument(workspaceId, documentId, userId);
  const topicId = await openTopic(doc, userId);
  if (!topicId) return [];
  return shown()
    .where(
      and(
        eq(statementTable.documentId, doc.id),
        eq(statementTable.contentHash, doc.contentHash ?? ""),
        eq(topicSlotTable.topicId, topicId),
      ),
    )
    .orderBy(asc(topicSlotTable.key), asc(statementTable.createdAt));
}

export async function addStatement(
  workspaceId: string,
  documentId: string,
  userId: string,
  body: SentStatement,
) {
  const doc = await loadDocument(workspaceId, documentId, userId, {
    need: "edit",
  });
  const topicId = await openTopic(doc, userId);
  if (!topicId) {
    throw new HTTPException(409, {
      message: "File the document on a topic first",
    });
  }
  const slots = (await slotsOf([topicId])).get(topicId) ?? [];
  const [outcome] = await proposeStatements(
    doc,
    slots,
    [body],
    "person",
    userId,
    true,
  );
  if (outcome?.result === "added" && outcome.id) return one(outcome.id);
  if (outcome?.result === "exists") {
    throw new HTTPException(409, {
      message:
        "The document has a confirmed statement for this slot. Reject it first",
    });
  }
  throw new HTTPException(400, {
    message:
      outcome?.result === "unknown_slot"
        ? `This topic has no slot "${body.slot}". Its slots: ${slots.map((slot) => slot.key).join(", ") || "none"}`
        : outcome?.result === "quote_not_found"
          ? "The quote is not in the document. Copy it from the text as it is"
          : "The value does not fit this slot",
  });
}

// A statement of the document, on the topic the document is filed on now.
// Missing for someone who cannot open that topic.
export async function statementOf(
  doc: Loaded,
  statementId: string,
  userId: string,
) {
  const topicId = await openTopic(doc, userId);
  const [found] = topicId
    ? await db
        .select({ statement: statementTable })
        .from(statementTable)
        .innerJoin(topicSlotTable, eq(topicSlotTable.id, statementTable.slotId))
        .where(
          and(
            eq(statementTable.id, statementId),
            eq(statementTable.documentId, doc.id),
            eq(topicSlotTable.topicId, topicId),
          ),
        )
    : [];
  if (!found || !topicId) throw notFound();
  return { statement: found.statement, topicId };
}

// Loads a statement of the document for someone who may decide on it. On a
// current document that is the people who decide on its topic: what they
// confirm there is the topic's answer.
async function forDecision(
  workspaceId: string,
  documentId: string,
  statementId: string,
  userId: string,
) {
  const doc = await loadDocument(workspaceId, documentId, userId, {
    need: "edit",
  });
  const found = await statementOf(doc, statementId, userId);
  if (doc.status === "current" && doc.topicId) {
    await assertDecides(workspaceId, doc, userId);
  }
  return { doc, ...found };
}

async function assertDecides(workspaceId: string, doc: Loaded, userId: string) {
  const topic = await getTopic(workspaceId, doc.topicId ?? "", userId);
  if (!topic.canDecide) {
    throw new HTTPException(403, {
      message:
        "Only the topic's decider changes the statements of its current document",
    });
  }
}

export async function confirmStatement(
  workspaceId: string,
  documentId: string,
  statementId: string,
  userId: string,
) {
  const { doc, statement, topicId } = await forDecision(
    workspaceId,
    documentId,
    statementId,
    userId,
  );
  if (statement.status === "rejected") {
    throw new HTTPException(409, {
      message: "A rejected statement cannot be confirmed. Write it again",
    });
  }
  const texts = [
    doc.contentHash,
    ...(doc.status === "current" ? [doc.approvedHash] : []),
  ];
  if (!texts.includes(statement.contentHash)) {
    throw new HTTPException(409, {
      message: "The document changed after this statement was written",
    });
  }
  if (statement.status === "proposed") {
    // On the current document this changes what the topic states.
    await changingTopic(topicId, (tx) =>
      tx
        .update(statementTable)
        .set({ status: "confirmed", decidedBy: userId, decidedAt: new Date() })
        .where(eq(statementTable.id, statement.id)),
    );
  }
  return one(statement.id);
}

export async function rejectStatement(
  workspaceId: string,
  documentId: string,
  statementId: string,
  userId: string,
  reason: string,
) {
  const { statement, topicId } = await forDecision(
    workspaceId,
    documentId,
    statementId,
    userId,
  );
  await changingTopic(topicId, (tx) =>
    tx
      .update(statementTable)
      .set({
        status: "rejected",
        statusReason: reason,
        decidedBy: userId,
        decidedAt: new Date(),
      })
      .where(eq(statementTable.id, statement.id)),
  );
  return one(statement.id);
}
