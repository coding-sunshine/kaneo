import { and, asc, eq, inArray, isNotNull, isNull, ne } from "drizzle-orm";
import db from "../../database";
import {
  documentSubscriberTable,
  projectTable,
  taskDocumentTable,
  taskTable,
  topicSubscriberTable,
  topicTable,
  userTable,
} from "../../database/schema";
import createNotification from "../../notification/controllers/create-notification";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { commentPreview } from "../../utils/comment-preview";
import { parseMentionIds } from "../../utils/parse-mentions";

type NotifiedDocument = { id: string; workspaceId: string; title: string };

async function existingUsers(ids: string[]) {
  if (!ids.length) return [];
  const rows = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(inArray(userTable.id, ids));
  return rows.map((row) => row.id);
}

async function userName(userId: string) {
  const [user] = await db
    .select({ name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, userId));
  return user?.name ?? null;
}

// The stored title, for mail and for a client with no text of its own.
const TITLES = {
  document_mention: (actor: string) => `${actor} mentioned you`,
  document_comment: (actor: string) => `${actor} commented`,
  document_proposed: (actor: string) => `${actor} proposed a document`,
  document_current: (actor: string) => `${actor} made a document current`,
  document_replaced: (actor: string) =>
    `${actor} replaced a document your issue links to`,
};

function send(
  doc: NotifiedDocument,
  recipients: string[],
  type: keyof typeof TITLES,
  actorName: string | null,
  extra: Record<string, unknown> = {},
) {
  const title = TITLES[type](actorName ?? "Someone");
  // persistNotification drops anyone who cannot see the document.
  return Promise.all(
    recipients.map((userId) =>
      createNotification({
        userId,
        type,
        title,
        content: doc.title || "Untitled",
        eventData: {
          documentTitle: doc.title,
          actorName,
          workspaceId: doc.workspaceId,
          ...extra,
        },
        resourceId: doc.id,
        resourceType: "document",
      }),
    ),
  );
}

// Mentions added to the body since the last save.
export async function notifyBodyMentions(
  doc: NotifiedDocument,
  actorId: string,
  before: string,
  after: string,
) {
  const previous = new Set(parseMentionIds(before));
  const added = parseMentionIds(after).filter(
    (id) => id !== actorId && !previous.has(id),
  );
  const recipients = await existingUsers(added);
  if (!recipients.length) return;
  await send(doc, recipients, "document_mention", await userName(actorId));
}

// Mentioned users get a mention; other subscribers get the comment.
export async function notifyComment(
  doc: NotifiedDocument,
  actorId: string,
  content: string,
) {
  const mentioned = await existingUsers(
    parseMentionIds(content).filter((id) => id !== actorId),
  );
  const subscribers = await db
    .select({ userId: documentSubscriberTable.userId })
    .from(documentSubscriberTable)
    .where(eq(documentSubscriberTable.documentId, doc.id));
  const others = subscribers
    .map((row) => row.userId)
    .filter((id) => id !== actorId && !mentioned.includes(id));
  const actorName = await userName(actorId);
  const preview = commentPreview(content);
  const extra = preview ? { commentPreview: preview } : {};
  await send(doc, mentioned, "document_mention", actorName, extra);
  await send(doc, others, "document_comment", actorName, extra);
}

// A new proposal on a topic, or a new current document, for the people who
// follow the topic. Not for whoever did it, and not for anyone in `told`, who
// heard of it another way.
export async function notifyTopicFollowers(
  doc: NotifiedDocument,
  topicId: string,
  actorId: string,
  type: "document_proposed" | "document_current",
  told: string[] = [],
) {
  const followers = await db
    .select({
      userId: topicSubscriberTable.userId,
      topicName: topicTable.name,
    })
    .from(topicSubscriberTable)
    .innerJoin(topicTable, eq(topicTable.id, topicSubscriberTable.topicId))
    .where(
      and(
        eq(topicSubscriberTable.topicId, topicId),
        ne(topicSubscriberTable.userId, actorId),
      ),
    );
  const [first] = followers;
  if (!first) return;
  await send(
    doc,
    followers.map((row) => row.userId).filter((id) => !told.includes(id)),
    type,
    await userName(actorId),
    { topicId, topicName: first.topicName },
  );
}

// A document was replaced by `doc`. The assignee of each open issue that
// links to the replaced one hears of it once, with one of their issues named.
// Returns who was told.
export async function notifyReplacedDocument(
  doc: NotifiedDocument,
  replacedId: string,
  topicId: string,
  actorId: string,
) {
  const issues = await db
    .selectDistinct({
      userId: taskTable.userId,
      taskId: taskTable.id,
      taskNumber: taskTable.number,
      taskTitle: taskTable.title,
      projectId: projectTable.id,
      projectSlug: projectTable.slug,
    })
    .from(taskDocumentTable)
    .innerJoin(taskTable, eq(taskTable.id, taskDocumentTable.taskId))
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(
      and(
        eq(taskDocumentTable.documentId, replacedId),
        eq(projectTable.workspaceId, doc.workspaceId),
        isNotNull(taskTable.userId),
        ne(taskTable.userId, actorId),
        isNull(taskTable.completedAt),
        isNull(taskTable.canceledAt),
        isNull(taskTable.archivedAt),
        // Still assigned after losing the team: the issue is not theirs to
        // hear about.
        projectAccessCondition(taskTable.userId, projectTable.id),
      ),
    )
    .orderBy(asc(projectTable.slug), asc(taskTable.number));
  const byAssignee = new Map<string, typeof issues>();
  for (const issue of issues) {
    if (!issue.userId) continue;
    byAssignee.set(issue.userId, [
      ...(byAssignee.get(issue.userId) ?? []),
      issue,
    ]);
  }
  if (!byAssignee.size) return [];
  const [[topic], actorName] = await Promise.all([
    db
      .select({ name: topicTable.name })
      .from(topicTable)
      .where(eq(topicTable.id, topicId)),
    userName(actorId),
  ]);
  // persistNotification drops anyone who cannot open the new document.
  await Promise.all(
    [...byAssignee].map(([userId, [first, ...more]]) =>
      send(doc, [userId], "document_replaced", actorName, {
        topicId,
        topicName: topic?.name,
        taskId: first?.taskId,
        taskNumber: first?.taskNumber,
        taskTitle: first?.taskTitle,
        projectId: first?.projectId,
        projectSlug: first?.projectSlug,
        taskCount: more.length + 1,
      }),
    ),
  );
  return [...byAssignee.keys()];
}
