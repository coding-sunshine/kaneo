import { eq } from "drizzle-orm";
import db from "../../database";
import { documentTable } from "../../database/schema";
import { loadDocument } from "./load-document";

// Sets a document aside in the Inbox until a date, or brings it back. The
// date is shared by everybody who sees the item, so it takes edit access.
// It is not an edit: `updatedAt` stays.
export async function snoozeDocument(
  workspaceId: string,
  id: string,
  userId: string,
  until: string | null,
) {
  await loadDocument(workspaceId, id, userId, { need: "edit" });
  const snoozedUntil = until ? new Date(until) : null;
  await db
    .update(documentTable)
    .set({ inboxSnoozedUntil: snoozedUntil })
    .where(eq(documentTable.id, id));
  return { id, snoozedUntil };
}
