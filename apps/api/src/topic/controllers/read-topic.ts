import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import db from "../../database";
import { documentTable, userTable } from "../../database/schema";
import { listDocuments } from "../../document/controllers/list-documents";
import { documentVisibility } from "../../document/visibility";
import { findTopics } from "./find-topics";
import { tasksOfTopics } from "./topic-tasks";

type Found = Awaited<ReturnType<typeof findTopics>>[number];

const head = ({ id, name, parentName, deciderName }: Found) => ({
  id,
  name,
  parentName,
  deciderName,
});

// The documents filed on a topic that wait for its decider.
const waiting = async (workspaceId: string, userId: string, topicId: string) =>
  (await listDocuments(workspaceId, userId, { topicId })).filter(
    (doc) => doc.status === "in_review",
  );

// The text that was approved. After a later edit that is the version kept at
// approval and never the live text: nobody approved the edit. Null when that
// version is gone.
const approvedText = sql<string | null>`CASE
  WHEN ${documentTable.contentHash} = ${documentTable.approvedHash}
    THEN ${documentTable.content}
  ELSE (
    SELECT approved.content FROM document_version AS approved
    WHERE approved.id = ${documentTable.approvedVersionId}
      AND approved.document_id = ${documentTable.id}
  )
END`;

// What is approved on the topics a text names, for an assistant to read
// before it drafts or answers. The text is sent for one topic only, so a
// broad question does not pull every approved document at once.
export async function getCurrent(
  workspaceId: string,
  userId: string,
  text: string,
) {
  const topics = await findTopics(workspaceId, userId, text);
  const tasks = await tasksOfTopics(
    workspaceId,
    userId,
    topics.map((topic) => topic.id),
  );
  const currentIds = topics.flatMap((topic) => topic.currentDocumentId ?? []);
  const current =
    currentIds.length === 0
      ? []
      : await db
          .select({
            id: documentTable.id,
            title: documentTable.title,
            approvedAt: documentTable.approvedAt,
            approvedByName: userTable.name,
            reason: documentTable.statusReason,
            contentHash: documentTable.contentHash,
            approvedHash: documentTable.approvedHash,
            text: topics.length === 1 ? approvedText : sql<string | null>`NULL`,
          })
          .from(documentTable)
          .leftJoin(userTable, eq(userTable.id, documentTable.approvedBy))
          .where(
            and(
              eq(documentTable.workspaceId, workspaceId),
              inArray(documentTable.id, currentIds),
              eq(documentTable.status, "current"),
              isNull(documentTable.deletedAt),
              documentVisibility(userId, documentTable),
            ),
          );
  return {
    topics: await Promise.all(
      topics.map(async (topic) => {
        const doc = current.find((row) => row.id === topic.currentDocumentId);
        return {
          ...head(topic),
          tasks: tasks.filter((task) => task.topicId === topic.id),
          unreviewed: (await waiting(workspaceId, userId, topic.id)).length,
          // The text stays last: an answer cut for length keeps the rest.
          current: doc
            ? {
                id: doc.id,
                title: doc.title,
                approvedAt: doc.approvedAt,
                approvedByName: doc.approvedByName,
                reason: doc.reason,
                editedSinceApproval: doc.contentHash !== doc.approvedHash,
                text: doc.text,
              }
            : null,
        };
      }),
    ),
  };
}

// What waits for a decision on the topics a text names. Titles only: an
// unapproved text is not something to answer from.
export async function listUnreviewed(
  workspaceId: string,
  userId: string,
  text: string,
) {
  const topics = await findTopics(workspaceId, userId, text);
  const tasks = await tasksOfTopics(
    workspaceId,
    userId,
    topics.map((topic) => topic.id),
  );
  return {
    topics: await Promise.all(
      topics.map(async (topic) => ({
        ...head(topic),
        tasks: tasks.filter((task) => task.topicId === topic.id),
        documents: (await waiting(workspaceId, userId, topic.id)).map(
          ({ id, title, kind, creatorName, filedAt, updatedAt }) => ({
            id,
            title,
            kind,
            creatorName,
            filedAt,
            updatedAt,
          }),
        ),
      })),
    ),
  };
}
