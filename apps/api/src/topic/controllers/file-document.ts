import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { documentTable } from "../../database/schema";
import { getDocument } from "../../document/controllers/get-document";
import { loadDocument } from "../../document/controllers/load-document";
import { getTopic } from "./get-topic";

// Files a document on a topic as a proposal. It moves to the topic's place,
// so everyone who can open the topic can read what is proposed.
export async function fileDocument(
  workspaceId: string,
  id: string,
  documentId: string,
  userId: string,
) {
  // Opening the topic is entering its place: the check a move makes.
  const topic = await getTopic(workspaceId, id, userId);
  const doc = await loadDocument(workspaceId, documentId, userId, {
    need: "edit",
  });
  if (doc.status === "current" || doc.status === "superseded") {
    throw new HTTPException(409, {
      message: `A ${doc.status} document cannot be filed again`,
    });
  }
  await db
    .update(documentTable)
    .set({
      scope: topic.scope,
      projectId: topic.projectId,
      workProjectId: topic.workProjectId,
      taskId: null,
      topicId: topic.id,
      status: "in_review",
      filedAt: new Date(),
    })
    .where(eq(documentTable.id, documentId));
  return getDocument(workspaceId, documentId, userId);
}
