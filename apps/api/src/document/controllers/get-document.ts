import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import db from "../../database";
import {
  documentShareTable,
  documentSubscriberTable,
  documentTable,
  projectTable,
  taskDocumentTable,
  taskTable,
  topicTable,
  userTable,
} from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { documentVisibility, topicAccess } from "../visibility";
import { readLineage } from "./lineage";
import { documentParentName, openParentId } from "./list-documents";
import { loadDocument } from "./load-document";
import { hasChildPages, pageAncestors } from "./page-ancestors";
import { countHiddenSharedTasks, sharedTasksOf } from "./share-with-task";

export async function getDocument(
  workspaceId: string,
  id: string,
  userId: string,
) {
  const doc = await loadDocument(workspaceId, id, userId);
  const manages = doc.role === "owner" || doc.role === "edit";
  const [
    shares,
    subscribers,
    [parent],
    revisionOf,
    citedBy,
    sharedTasks,
    hiddenSharedTaskCount,
    ancestors,
    hasChildren,
  ] = await Promise.all([
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
        projectId: openParentId(userId, documentTable.projectId),
        taskId: openParentId(userId, documentTable.taskId),
        topicName: topicTable.name,
        supersedesDocumentId: sql<string | null>`(
          SELECT replaced_document.id FROM document AS replaced_document
          WHERE replaced_document.id = ${documentTable.supersedesDocumentId}
            AND replaced_document.workspace_id = ${documentTable.workspaceId}
            AND ${documentVisibility(userId, {
              id: sql`replaced_document.id`,
              workspaceId: sql`replaced_document.workspace_id`,
              creatorId: sql`replaced_document.creator_id`,
              scope: sql`replaced_document.scope`,
              projectId: sql`replaced_document.project_id`,
              workProjectId: sql`replaced_document.work_project_id`,
              taskId: sql`replaced_document.task_id`,
            })}
        )`,
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
    readLineage(workspaceId, id, userId),
    // Each issue once, however many places link it, and only issues of this
    // workspace the viewer can open.
    db
      .selectDistinct({
        id: taskTable.id,
        title: taskTable.title,
        number: taskTable.number,
        projectId: projectTable.id,
        projectSlug: projectTable.slug,
      })
      .from(taskDocumentTable)
      .innerJoin(taskTable, eq(taskTable.id, taskDocumentTable.taskId))
      .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
      .where(
        and(
          eq(taskDocumentTable.documentId, id),
          // Sharing with an issue is not a link in a text.
          ne(taskDocumentTable.source, "share"),
          eq(projectTable.workspaceId, workspaceId),
          projectAccessCondition(userId, projectTable.id),
        ),
      )
      .orderBy(asc(projectTable.slug), asc(taskTable.number)),
    sharedTasksOf(workspaceId, id, userId),
    manages ? countHiddenSharedTasks(workspaceId, id, userId) : 0,
    pageAncestors(workspaceId, doc.parentDocumentId, userId),
    hasChildPages(id),
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
    projectId: parent?.projectId ?? null,
    workProjectId: doc.workProjectId,
    taskId: parent?.taskId ?? null,
    parentName: parent?.name ?? null,
    kind: doc.kind,
    status: doc.status,
    sourceClient: doc.sourceClient,
    topicId: topicName === null ? null : doc.topicId,
    topicName,
    // Named only to someone who can open the topic and the replaced document.
    supersedesDocumentId:
      topicName === null ? null : (parent?.supersedesDocumentId ?? null),
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
    revisionOf,
    citedBy,
    sharedTasks,
    hiddenSharedTaskCount,
    shares,
    subscriberIds: subscribers.map((row) => row.userId),
    ancestors,
    hasChildren,
  };
}
