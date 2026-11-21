import { eq, inArray } from "drizzle-orm";
import db from "../../database";
import { documentSubscriberTable, userTable } from "../../database/schema";
import createNotification from "../../notification/controllers/create-notification";
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

function send(
  doc: NotifiedDocument,
  recipients: string[],
  type: "document_comment" | "document_mention",
  actorName: string | null,
  commentPreview?: string,
) {
  const title =
    type === "document_mention"
      ? `${actorName ?? "Someone"} mentioned you`
      : `${actorName ?? "Someone"} commented`;
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
  const preview = content.slice(0, 160);
  await send(doc, mentioned, "document_mention", actorName, preview);
  await send(doc, others, "document_comment", actorName, preview);
}
