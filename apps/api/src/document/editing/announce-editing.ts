import { eq } from "drizzle-orm";
import db from "../../database";
import { userTable } from "../../database/schema";
import { loadDocument } from "../controllers/load-document";
import { tellReaders } from "../reader-hint";

// Readers hear one hint per window; a client repeats it while typing.
const WINDOW_MS = 2_000;
const lastSent = new Map<string, number>();

function due(key: string, now: number) {
  const last = lastSent.get(key);
  if (last !== undefined && now - last < WINDOW_MS) return false;
  if (lastSent.size > 1_000)
    for (const [old, at] of lastSent)
      if (now - at >= WINDOW_MS) lastSent.delete(old);
  lastSent.set(key, now);
  return true;
}

export async function announceEditing(
  workspaceId: string,
  documentId: string,
  userId: string,
) {
  await loadDocument(workspaceId, documentId, userId, { need: "edit" });
  if (!due(`${userId}:${documentId}`, Date.now())) return { announced: false };
  const [editor] = await db
    .select({ name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, userId));
  await tellReaders({
    workspaceId,
    documentId,
    exceptUserId: userId,
    message: {
      type: "DOCUMENT_EDITING",
      workspaceId,
      documentId,
      userId,
      name: editor?.name ?? "",
    },
  });
  return { announced: true };
}
