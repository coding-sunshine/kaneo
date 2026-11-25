import { and, eq, inArray, ne } from "drizzle-orm";
import db from "../../database";
import {
  documentSubscriberTable,
  topicSubscriberTable,
  topicTable,
  userTable,
} from "../../database/schema";
import createNotification from "../../notification/controllers/create-notification";
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
};

function send(
  doc: NotifiedDocument,
  recipients: string[],
  type: keyof typeof TITLES,
  actorName: string | null,
  commentPreview?: string,
  topic?: { id: string; name: string },
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
          ...(commentPreview && { commentPreview }),
          ...(topic && { topicId: topic.id, topicName: topic.name }),
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
  await send(doc, mentioned, "document_mention", actorName, preview);
  await send(doc, others, "document_comment", actorName, preview);
}

// A new proposal on a topic, or a new current document, for the people who
// follow the topic. Not for whoever did it.
export async function notifyTopicFollowers(
  doc: NotifiedDocument,
  topicId: string,
  actorId: string,
  type: "document_proposed" | "document_current",
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
    followers.map((row) => row.userId),
    type,
    await userName(actorId),
    undefined,
    { id: topicId, name: first.topicName },
  );
}
