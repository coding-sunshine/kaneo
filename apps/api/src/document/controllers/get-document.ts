import { eq, inArray } from "drizzle-orm";
import db from "../../database";
import {
  documentShareTable,
  documentSubscriberTable,
  documentTable,
  userTable,
} from "../../database/schema";
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
    db
      .select({ name: documentParentName(userId) })
      .from(documentTable)
      .where(eq(documentTable.id, id)),
  ]);
  const personIds = [doc.creatorId, doc.updatedById].filter(
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
