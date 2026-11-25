import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { documentTable } from "../../database/schema";
import { getDocument } from "../../document/controllers/get-document";
import { loadDocument } from "../../document/controllers/load-document";
import { notifyTopicFollowers } from "../../document/controllers/notify";
import { grantTaskAccess } from "../../document/controllers/share-with-task";
import { getTopic } from "./get-topic";

// Files a document on a topic as a proposal. It moves to the topic's place,
// so everyone who can open the topic can read what is proposed. With
// `replace`, it also records that its author means it to replace the current
// document. Saying so approves nothing.
export async function fileDocument(
  workspaceId: string,
  id: string,
  documentId: string,
  userId: string,
  replace = false,
) {
  // Opening the topic is entering its place: the check a move makes.
  const topic = await getTopic(workspaceId, id, userId);
  if (replace && !topic.currentDocumentId) {
    throw new HTTPException(409, {
      message:
        "This topic has no current document to replace. File the document as a proposal.",
    });
  }
  const doc = await loadDocument(workspaceId, documentId, userId, {
    need: "edit",
  });
  if (doc.status === "current" || doc.status === "superseded") {
    throw new HTTPException(409, {
      message: `A ${doc.status} document cannot be filed again`,
    });
  }
  const { taskId } = doc;
  await db.transaction(async (tx) => {
    // The document leaves its issue. Everyone on the issue could read it
    // there, and still can.
    if (taskId) await grantTaskAccess(tx, taskId, documentId, userId);
    await tx
      .update(documentTable)
      .set({
        scope: topic.scope,
        projectId: topic.projectId,
        workProjectId: topic.workProjectId,
        taskId: null,
        topicId: topic.id,
        status: "in_review",
        filedAt: new Date(),
        supersedesDocumentId: replace ? topic.currentDocumentId : null,
      })
      .where(eq(documentTable.id, documentId));
  });
  // After the move: a follower is told only about a document they can open.
  // Filing a proposal again on its own topic is not news.
  if (doc.topicId !== topic.id) {
    await notifyTopicFollowers(doc, topic.id, userId, "document_proposed");
  }
  return getDocument(workspaceId, documentId, userId);
}
