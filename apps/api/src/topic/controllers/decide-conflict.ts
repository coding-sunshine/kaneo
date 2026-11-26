import { and, eq, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  documentTable,
  statementConflictTable,
  statementTable,
  topicTable,
} from "../../database/schema";
import { loadDocument } from "../../document/controllers/load-document";
import { notDecider } from "./decide";
import { getTopic } from "./get-topic";
import { receiptOf } from "./receipt";
import { openTopic } from "./statements";

const notFound = () =>
  new HTTPException(404, { message: "Document or conflict not found" });

type Decided = {
  decision: "replace" | "keep" | "tolerate" | "dismiss";
  reason: string;
  tolerateUntil?: string;
};

/**
 * The topic's decider settles one conflict of a document. `keep` is carried
 * out by rejecting the document's statement, and leaves no decision behind:
 * if the document states the value again, the conflict is open again.
 * `dismiss` says the two do not contradict each other, and says nothing about
 * the document's value: its statement stays as it is.
 */
export async function decideConflict(
  workspaceId: string,
  documentId: string,
  conflictId: string,
  userId: string,
  { decision, reason, tolerateUntil }: Decided,
) {
  const doc = await loadDocument(workspaceId, documentId, userId);
  const topicId = await openTopic(doc, userId);
  if (!topicId) throw notFound();
  const topic = await getTopic(workspaceId, topicId, userId);
  if (!topic.canDecide) throw notDecider();
  const until = decision === "tolerate" ? new Date(tolerateUntil ?? "") : null;
  if (until && !(until.getTime() > Date.now())) {
    throw new HTTPException(400, {
      message:
        "Give the date until which the two may differ. It must lie ahead",
    });
  }

  return db.transaction(async (tx) => {
    // The same locks as an approval, so the pair that is decided is the pair
    // that stands: no approval and no edit lands in between.
    await tx
      .select({ id: topicTable.id })
      .from(topicTable)
      .where(eq(topicTable.id, topicId))
      .for("no key update");
    const [text] = await tx
      .select({ contentHash: documentTable.contentHash })
      .from(documentTable)
      .where(
        and(
          eq(documentTable.id, doc.id),
          eq(documentTable.topicId, topicId),
          isNull(documentTable.deletedAt),
        ),
      )
      .for("update");
    const receipt =
      text && (await receiptOf(tx, { id: doc.id, ...text }, topicId, userId));
    // A pair that is gone, or whose other side the decider cannot open,
    // answers like an unknown id.
    const conflict = receipt?.conflicts.find(
      (found) => found.id === conflictId,
    );
    if (!conflict) throw notFound();

    const decided = { decidedBy: userId, decidedAt: new Date() };
    const statement = eq(statementTable.id, conflict.statementId);
    if (decision === "keep") {
      await tx
        .update(statementTable)
        .set({ status: "rejected", statusReason: reason, ...decided })
        .where(statement);
      await tx
        .delete(statementConflictTable)
        .where(eq(statementConflictTable.pairHash, conflictId));
      return {
        ...conflict,
        status: "resolved" as const,
        reason,
        tolerateUntil: null,
      };
    }
    const row = { decision, reason, tolerateUntil: until, ...decided };
    await tx
      .insert(statementConflictTable)
      .values({
        pairHash: conflictId,
        slotId: conflict.slotId,
        documentId: doc.id,
        againstDocumentId: conflict.current.documentId,
        ...row,
      })
      .onConflictDoUpdate({
        target: statementConflictTable.pairHash,
        set: row,
      });
    if (decision === "tolerate") {
      return {
        ...conflict,
        status: "tolerated" as const,
        reason,
        tolerateUntil: until,
      };
    }
    if (decision === "dismiss") {
      return {
        ...conflict,
        status: "resolved" as const,
        reason,
        tolerateUntil: null,
      };
    }
    // The decider says the document's value is right: that confirms it.
    await tx
      .update(statementTable)
      .set({ status: "confirmed", ...decided })
      .where(and(statement, eq(statementTable.status, "proposed")));
    return {
      ...conflict,
      confirmed: true,
      status: "resolved" as const,
      reason,
      tolerateUntil: null,
    };
  });
}
