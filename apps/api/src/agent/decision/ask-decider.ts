import { and, eq } from "drizzle-orm";
import db from "../../database";
import {
  documentTable,
  notificationTable,
  topicTable,
} from "../../database/schema";
import { askDecidersToApprove } from "../../document/controllers/notify";

/**
 * After a decision draft is filed, makes sure the topic's decider and backup
 * have it in their inbox to approve.
 */
export async function askDecider(
  workspaceId: string,
  result: string,
  actorId: string,
) {
  const { documentId, topicId } = JSON.parse(result) as {
    documentId?: string;
    topicId?: string;
  };
  if (!documentId || !topicId) return;
  const [topic] = await db
    .select({
      name: topicTable.name,
      deciderId: topicTable.deciderId,
      backupDeciderId: topicTable.backupDeciderId,
    })
    .from(topicTable)
    .where(
      and(eq(topicTable.id, topicId), eq(topicTable.workspaceId, workspaceId)),
    );
  const [doc] = await db
    .select({ id: documentTable.id, title: documentTable.title })
    .from(documentTable)
    .where(eq(documentTable.id, documentId));
  if (!topic || !doc) return;
  const told = await db
    .select({ userId: notificationTable.userId })
    .from(notificationTable)
    .where(
      and(
        eq(notificationTable.resourceId, documentId),
        eq(notificationTable.type, "document_proposed"),
      ),
    );
  await askDecidersToApprove(
    { ...doc, workspaceId },
    {
      id: topicId,
      name: topic.name,
      deciderIds: [topic.deciderId, topic.backupDeciderId].filter(
        (id): id is string => Boolean(id),
      ),
    },
    actorId,
    told.map((row) => row.userId),
  );
}
