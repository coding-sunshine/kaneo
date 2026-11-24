import { and, eq, inArray } from "drizzle-orm";
import db from "../../database";
import {
  documentShareTable,
  documentSubscriberTable,
  documentTable,
  topicTable,
  userTable,
} from "../../database/schema";
import { topicAccess } from "../visibility";
import { documentParentName } from "./list-documents";
import { loadDocument } from "./load-document";

export async function getDocument(
  workspaceId: string,
  id: string,
  userId: string,
) {
  const doc = await loadDocument(workspaceId, id, userId);
  const [shares, subscribers, [parent]] = await Promise.all([
    db
      .select({
        userId: documentShareTable.userId,
        name: userTable.name,
        image: userTable.image,
        access: documentShareTable.access,
      })
      .from(documentShareTable)
      .innerJoin(userTable, eq(userTable.id, documentShareTable.userId))
      .where(eq(documentShareTable.documentId, id))
      .orderBy(documentShareTable.createdAt),
    db
      .select({ userId: documentSubscriberTable.userId })
      .from(documentSubscriberTable)
      .where(eq(documentSubscriberTable.documentId, id)),
    // A document shared by name can sit on a topic the viewer cannot open.
    // That topic stays unnamed, like a team they cannot enter.
    db
      .select({
        name: documentParentName(userId),
        topicName: topicTable.name,
      })
      .from(documentTable)
      .leftJoin(
        topicTable,
        and(
          eq(topicTable.id, documentTable.topicId),
          topicAccess(userId, topicTable.id),
        ),
      )
      .where(eq(documentTable.id, id)),
  ]);
  const topicName = parent?.topicName ?? null;
  const personIds = [doc.creatorId, doc.updatedById, doc.approvedBy].filter(
    (value): value is string => value !== null,
  );
  const people = personIds.length
    ? await db
        .select({
          id: userTable.id,
          name: userTable.name,
          image: userTable.image,
        })
        .from(userTable)
        .where(inArray(userTable.id, personIds))
    : [];
  const person = (personId: string | null) =>
    people.find((candidate) => candidate.id === personId);

  return {
    id: doc.id,
    workspaceId: doc.workspaceId,
    title: doc.title,
    icon: doc.icon,
    color: doc.color,
    content: doc.content,
    scope: doc.scope,
    projectId: doc.projectId,
    workProjectId: doc.workProjectId,
    taskId: doc.taskId,
    parentName: parent?.name ?? null,
    kind: doc.kind,
    status: doc.status,
    sourceClient: doc.sourceClient,
    topicId: topicName === null ? null : doc.topicId,
    topicName,
    // It was current on the same topic, so it is named to the same people.
    supersedesDocumentId: topicName === null ? null : doc.supersedesDocumentId,
    filedAt: doc.filedAt,
    statusReason: doc.statusReason,
    approvedById: doc.approvedBy,
    approvedByName: person(doc.approvedBy)?.name ?? null,
    approvedAt: doc.approvedAt,
    approvedHash: doc.approvedHash,
    approvedVersionId: doc.approvedVersionId,
    confirmedAt: doc.confirmedAt,
    // The database writes it on every insert, so it is only null in the type.
    contentHash: doc.contentHash ?? "",
    generalAccess: doc.generalAccess,
    creatorId: doc.creatorId,
    creatorName: person(doc.creatorId)?.name ?? null,
    creatorImage: person(doc.creatorId)?.image ?? null,
    updatedById: doc.updatedById,
    updatedByName: person(doc.updatedById)?.name ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    role: doc.role,
    shares,
    subscriberIds: subscribers.map((row) => row.userId),
  };
}
