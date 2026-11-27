import { and, eq, isNull, lte, ne, or, sql } from "drizzle-orm";
import db from "../database";
import { documentSubscriberTable, documentTable } from "../database/schema";
import createNotification from "../notification/controllers/create-notification";
import { workspaceIsActive } from "../workspace/archive/active-workspace-sql";

export const INBOX_REMINDER_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

// In the Inbox for three days or more, not set aside, and not yet reminded
// during this stay.
const waiting = (now: Date) =>
  and(
    isNull(documentTable.deletedAt),
    isNull(documentTable.topicId),
    ne(documentTable.scope, "private"),
    lte(
      documentTable.inboxSince,
      new Date(now.getTime() - INBOX_REMINDER_AFTER_MS),
    ),
    or(
      isNull(documentTable.inboxSnoozedUntil),
      lte(documentTable.inboxSnoozedUntil, now),
    ),
    or(
      isNull(documentTable.inboxRemindedAt),
      sql`${documentTable.inboxRemindedAt} < ${documentTable.inboxSince}`,
    ),
  );

type Waiting = { id: string; workspaceId: string; title: string };

// The author and the people who follow the document. persistNotification
// drops anyone who cannot open it.
async function remind(doc: Waiting, now: Date) {
  // Claim first: of two runs that see the same document, one sends.
  const [claimed] = await db
    .update(documentTable)
    .set({ inboxRemindedAt: now })
    .where(and(eq(documentTable.id, doc.id), waiting(now)))
    .returning({ creatorId: documentTable.creatorId });
  if (!claimed) return;
  const followers = await db
    .select({ userId: documentSubscriberTable.userId })
    .from(documentSubscriberTable)
    .where(eq(documentSubscriberTable.documentId, doc.id));
  const people = new Set(followers.map((row) => row.userId));
  if (claimed.creatorId) people.add(claimed.creatorId);
  for (const userId of people) {
    await createNotification({
      userId,
      type: "document_inbox_waiting",
      title: "A document has waited three days in the Inbox",
      content: doc.title || "Untitled",
      eventData: { documentTitle: doc.title, workspaceId: doc.workspaceId },
      resourceId: doc.id,
      resourceType: "document",
    });
  }
}

export async function checkInboxReminders(
  now = new Date(),
): Promise<{ degraded: boolean }> {
  let degraded = false;
  const due = await db
    .select({
      id: documentTable.id,
      workspaceId: documentTable.workspaceId,
      title: documentTable.title,
    })
    .from(documentTable)
    .where(and(waiting(now), workspaceIsActive(documentTable.workspaceId)));
  for (const doc of due) {
    try {
      await remind(doc, now);
    } catch (error) {
      degraded = true;
      console.error("Failed to send an Inbox reminder", {
        documentId: doc.id,
        error,
      });
    }
  }
  return { degraded };
}
