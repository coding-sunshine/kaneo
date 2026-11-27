import { and, asc, eq, ne } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  documentTable,
  type StatementResult,
  type StatementSource,
  statementTable,
  topicSlotTable,
  topicTable,
  userTable,
} from "../../database/schema";
import { loadDocument } from "../../document/controllers/load-document";
import { topicAccess } from "../../document/visibility";
import {
  collapse,
  documentText,
  MIN_QUOTE_LENGTH,
  quoteStart,
  textBlocks,
} from "../statement-text";
import { normalizeValue } from "../statement-value";
import { changingTopic, type Transaction } from "./flag-dependents";
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
 * fit the slot. A value the slot already has keeps its statement. With
 * `replace` (a person) a new value replaces the slot's proposal, never a
 * confirmed statement. Without it (the model) a new value is added beside the
 * model's own proposals, as a long text can state two values for one fact;
 * a free-text slot keeps the first value found.
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
    const held = await db
      .select({
        id: statementTable.id,
        status: statementTable.status,
        source: statementTable.source,
        normalized: statementTable.normalized,
      })
      .from(statementTable)
      .where(
        and(
          eq(statementTable.slotId, slot.id),
          eq(statementTable.documentId, doc.id),
          eq(statementTable.contentHash, contentHash),
          ne(statementTable.status, "rejected"),
        ),
      )
      .orderBy(asc(statementTable.createdAt));
    const same = held.find((row) => row.normalized === normalized);
    const existing = replace ? (same ?? held[0]) : same;
    const kept = replace
      ? existing?.status === "confirmed"
      : existing !== undefined ||
        (held.length > 0 &&
          (slot.type === "term" ||
            held.some(
              (row) => row.source !== "model" || row.status !== "proposed",
            )));
    if (kept) {
      const id = existing?.id ?? held[0]?.id;
      results.push({ slot: slot.key, result: "exists", id });
      continue;
    }
    if (existing) {
      // Only while it is still a proposal: one confirmed meanwhile stays.
      const [replaced] = await db
        .update(statementTable)
        .set(values)
        .where(
          and(
            eq(statementTable.id, existing.id),
            eq(statementTable.status, "proposed"),
          ),
        )
        .returning({ id: statementTable.id });
      results.push({
        slot: slot.key,
        result: replaced ? "added" : "exists",
        id: existing.id,
      });
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
      // Two writers at once: the value keeps the first statement.
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
 * is still in the new text are written again for it. The words around a quote
 * can turn its meaning, so a confirmation is kept only when every paragraph
 * that holds the quote reads as it did before; otherwise the statement comes
 * back as a proposal and a person confirms again. An edit elsewhere in the
 * text is read by whoever approves the document next. The old rows stay,
 * because the answer of a current document is read from the text that was
 * approved.
 */
export async function carryStatements(
  documentId: string,
  fromHash: string | null,
  toHash: string | null,
  before: string,
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
  const was = new Set(textBlocks(before));
  const blocks = textBlocks(content);
  const carried = previous.flatMap((statement) => {
    const start = text.indexOf(statement.quote);
    if (start < 0) return [];
    const holding = blocks.filter((block) => block.includes(statement.quote));
    const untouched =
      statement.status === "confirmed" &&
      holding.length > 0 &&
      holding.every((block) => was.has(block));
    return [
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
        ...(untouched && {
          status: "confirmed" as const,
          decidedBy: statement.decidedBy,
          decidedAt: statement.decidedAt,
        }),
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
  if (doc.status === "current") await assertDecides(workspaceId, doc, userId);
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
          ? `The quote is not in the document. Copy at least ${MIN_QUOTE_LENGTH} characters from the text as they are`
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
// current document and on a proposal that is the people who decide on its
// topic: what they confirm there is, or may become, the topic's answer.
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
  if ((doc.status === "current" || doc.status === "in_review") && doc.topicId) {
    await assertDecides(workspaceId, doc, userId);
  }
  return { doc, ...found };
}

async function assertDecides(workspaceId: string, doc: Loaded, userId: string) {
  const topic = await getTopic(workspaceId, doc.topicId ?? "", userId);
  if (!topic.canDecide) {
    throw new HTTPException(403, {
      message:
        "Only the topic's decider or backup changes the statements of its current document and decides on those of a proposal",
    });
  }
}

export async function confirmStatement(
  workspaceId: string,
  documentId: string,
  statementId: string,
  userId: string,
) {
  const { statement, topicId } = await forDecision(
    workspaceId,
    documentId,
    statementId,
    userId,
  );
  // On the current document this changes what the topic states.
  await changingTopic(topicId, async (tx) => {
    // Read again under the topic's lock: a reject or an edit that landed
    // while this request waited decides what happens now.
    const { status, contentHash, slotId, documentId, doc } =
      await lockedStatement(tx, statement.id);
    if (status === "rejected") {
      throw new HTTPException(409, {
        message: "A rejected statement cannot be confirmed. Write it again",
      });
    }
    const texts = [
      doc.contentHash,
      ...(doc.status === "current" ? [doc.approvedHash] : []),
    ];
    if (!texts.includes(contentHash)) {
      throw new HTTPException(409, {
        message: "The document changed after this statement was written",
      });
    }
    // A text that states two values for one fact has one confirmed value.
    const [other] = await tx
      .select({ id: statementTable.id })
      .from(statementTable)
      .where(
        and(
          eq(statementTable.slotId, slotId),
          eq(statementTable.documentId, documentId),
          eq(statementTable.contentHash, contentHash),
          eq(statementTable.status, "confirmed"),
          ne(statementTable.id, statement.id),
        ),
      );
    if (other) {
      throw new HTTPException(409, {
        message:
          "The document has a confirmed statement for this slot. Reject it first",
      });
    }
    if (status === "proposed") {
      await tx
        .update(statementTable)
        .set({ status: "confirmed", decidedBy: userId, decidedAt: new Date() })
        .where(eq(statementTable.id, statement.id));
    }
  });
  return one(statement.id);
}

// The statement and its document, locked in that order after the topic.
async function lockedStatement(tx: Transaction, statementId: string) {
  const [locked] = await tx
    .select({
      status: statementTable.status,
      contentHash: statementTable.contentHash,
      documentId: statementTable.documentId,
      slotId: statementTable.slotId,
    })
    .from(statementTable)
    .where(eq(statementTable.id, statementId))
    .for("update");
  if (!locked) throw notFound();
  const [doc] = await tx
    .select({
      contentHash: documentTable.contentHash,
      approvedHash: documentTable.approvedHash,
      status: documentTable.status,
    })
    .from(documentTable)
    .where(eq(documentTable.id, locked.documentId))
    .for("update");
  if (!doc) throw notFound();
  return { ...locked, doc };
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
  await changingTopic(topicId, async (tx) => {
    // A reject that landed first keeps its reason and its person.
    const { status } = await lockedStatement(tx, statement.id);
    if (status === "rejected") return;
    await tx
      .update(statementTable)
      .set({
        status: "rejected",
        statusReason: reason,
        decidedBy: userId,
        decidedAt: new Date(),
      })
      .where(eq(statementTable.id, statement.id));
  });
  return one(statement.id);
}
