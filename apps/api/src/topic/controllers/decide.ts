import { and, eq, isNull, ne } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { documentTable } from "../../database/schema";
import { getDocument } from "../../document/controllers/get-document";
import { loadDocument } from "../../document/controllers/load-document";
import {
  notifyReplacedDocument,
  notifyTopicFollowers,
} from "../../document/controllers/notify";
import { recordVersion } from "../../document/controllers/record-version";
import { changingTopic } from "./flag-dependents";
import { getTopic } from "./get-topic";
import { receiptOf } from "./receipt";

// A document on a topic, for the people who decide on that topic.
async function loadForDecision(
  workspaceId: string,
  id: string,
  documentId: string,
  userId: string,
) {
  const topic = await getTopic(workspaceId, id, userId);
  const doc = await loadDocument(workspaceId, documentId, userId);
  if (doc.topicId !== topic.id) {
    throw new HTTPException(404, { message: "Document not found" });
  }
  if (!topic.canDecide) throw notDecider();
  return doc;
}

export const notDecider = () =>
  new HTTPException(403, {
    message:
      "Only the topic's decider, its backup or a workspace owner can do that",
  });

const notCurrent = () =>
  new HTTPException(409, {
    message: "This is not the current document on the topic",
  });

// Approves a proposal, or the current document again after an edit. The
// document that was current becomes superseded in the same transaction.
export async function makeCurrent(
  workspaceId: string,
  id: string,
  documentId: string,
  userId: string,
  reason: string,
  /** The hash of the text the approver read, when the caller sends one. */
  seenHash?: string,
) {
  await loadForDecision(workspaceId, id, documentId, userId);
  const proposal = await changingTopic(id, async (tx) => {
    // The hash and the kept text come from one locked row, so an edit that
    // lands meanwhile cannot make them disagree.
    const [doc] = await tx
      .select({
        title: documentTable.title,
        content: documentTable.content,
        contentHash: documentTable.contentHash,
        status: documentTable.status,
      })
      .from(documentTable)
      .where(
        and(
          eq(documentTable.id, documentId),
          eq(documentTable.topicId, id),
          isNull(documentTable.deletedAt),
        ),
      )
      .for("update");
    if (!doc || (doc.status !== "in_review" && doc.status !== "current")) {
      throw new HTTPException(409, {
        message: "Only a proposal or the current document can be made current",
      });
    }
    // An approval covers the text that was read, not whatever is there now.
    if (seenHash !== undefined && doc.contentHash !== seenHash) {
      throw new HTTPException(409, {
        message:
          "This document changed after you opened it. Read it again, then approve it.",
      });
    }
    // Counted as the approver sees them: a conflict with a document this
    // person cannot open would tell them what it says. Read only, before the
    // first write.
    const { conflicts } = await receiptOf(
      tx,
      { id: documentId, contentHash: doc.contentHash },
      id,
      userId,
    );
    if (conflicts.some((conflict) => conflict.status === "open")) {
      throw new HTTPException(409, {
        message:
          "This document states something else than the current one. Settle each conflict first.",
      });
    }
    const [replaced] = await tx
      .update(documentTable)
      .set({ status: "superseded", statusReason: reason })
      .where(
        and(
          eq(documentTable.topicId, id),
          eq(documentTable.status, "current"),
          isNull(documentTable.deletedAt),
          ne(documentTable.id, documentId),
        ),
      )
      .returning({ id: documentTable.id });
    // Its own history entry, which no later edit folds into.
    const approvedVersionId = await recordVersion(
      documentId,
      userId,
      { title: doc.title, content: doc.content },
      { fold: false, database: tx },
    );
    await tx
      .update(documentTable)
      .set({
        status: "current",
        statusReason: reason,
        approvedBy: userId,
        approvedAt: new Date(),
        approvedHash: doc.contentHash,
        approvedVersionId,
        confirmedAt: null,
        // Not what its author meant to replace: what it did replace.
        supersedesDocumentId: replaced?.id ?? null,
      })
      .where(eq(documentTable.id, documentId));
    return doc.status === "in_review"
      ? { title: doc.title, replacedId: replaced?.id }
      : undefined;
  });
  // The topic has a new current document. Approving the same one again
  // after an edit is not that.
  if (proposal) {
    const made = { id: documentId, workspaceId, title: proposal.title };
    // Open work that links to the replaced document. Its assignee is told
    // that, and not a second time as a follower of the topic.
    const told = proposal.replacedId
      ? await notifyReplacedDocument(made, proposal.replacedId, id, userId)
      : [];
    await notifyTopicFollowers(made, id, userId, "document_current", told);
  }
  return getDocument(workspaceId, documentId, userId);
}

// "Still current": the approval is as good today as when it was given.
export async function confirmCurrent(
  workspaceId: string,
  id: string,
  documentId: string,
  userId: string,
) {
  const doc = await loadForDecision(workspaceId, id, documentId, userId);
  if (doc.status !== "current") throw notCurrent();
  await db
    .update(documentTable)
    .set({ confirmedAt: new Date() })
    .where(eq(documentTable.id, documentId));
  return getDocument(workspaceId, documentId, userId);
}

// Back to a proposal. The topic has no current document until one is made.
export async function setAside(
  workspaceId: string,
  id: string,
  documentId: string,
  userId: string,
) {
  const doc = await loadForDecision(workspaceId, id, documentId, userId);
  if (doc.status !== "current") throw notCurrent();
  await changingTopic(id, (tx) =>
    tx
      .update(documentTable)
      .set({
        status: "in_review",
        statusReason: null,
        approvedBy: null,
        approvedAt: null,
        approvedHash: null,
        approvedVersionId: null,
        supersedesDocumentId: null,
        confirmedAt: null,
      })
      .where(eq(documentTable.id, documentId)),
  );
  return getDocument(workspaceId, documentId, userId);
}
