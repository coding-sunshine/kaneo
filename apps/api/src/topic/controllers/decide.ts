import { and, eq, isNull, ne } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { documentTable, topicTable } from "../../database/schema";
import { getDocument } from "../../document/controllers/get-document";
import { loadDocument } from "../../document/controllers/load-document";
import { recordVersion } from "../../document/controllers/record-version";
import { getTopic } from "./get-topic";

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
  if (!topic.canDecide) {
    throw new HTTPException(403, {
      message:
        "Only the topic's decider, its backup or a workspace owner can do that",
    });
  }
  return doc;
}

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
) {
  await loadForDecision(workspaceId, id, documentId, userId);
  await db.transaction(async (tx) => {
    // One approval at a time on a topic. The `one_current` index is the
    // backstop.
    await tx
      .select({ id: topicTable.id })
      .from(topicTable)
      .where(eq(topicTable.id, id))
      .for("no key update");
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
        ...(replaced && { supersedesDocumentId: replaced.id }),
      })
      .where(eq(documentTable.id, documentId));
  });
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
  await db
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
    .where(eq(documentTable.id, documentId));
  return getDocument(workspaceId, documentId, userId);
}
