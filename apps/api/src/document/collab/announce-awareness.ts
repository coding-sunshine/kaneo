import { loadDocument } from "../controllers/load-document";
import { tellReaders } from "../reader-hint";
import { assertCoeditingOn } from "./coediting-config";

// Cursors and selections: passed on, never stored.
export async function announceAwareness(
  workspaceId: string,
  documentId: string,
  userId: string,
  body: { update: string },
) {
  assertCoeditingOn();
  await loadDocument(workspaceId, documentId, userId, { need: "edit" });
  await tellReaders({
    workspaceId,
    documentId,
    exceptUserId: userId,
    message: {
      type: "DOCUMENT_COLLAB_AWARENESS",
      workspaceId,
      documentId,
      update: body.update,
    },
  });
  return { applied: true };
}
