import { eq } from "drizzle-orm";
import * as Y from "yjs";
import db from "../../database";
import { documentCollabStateTable } from "../../database/schema";
import { ApiError } from "../../errors/api-error";
import { loadDocument } from "../controllers/load-document";
import { tellReaders } from "../reader-hint";
import { assertCoeditingOn } from "./coediting-config";
import { readUpdate, toBase64 } from "./yjs-update";

// Merged into the stored state under a row lock, so concurrent updates from
// several editors all land; Yjs makes the order irrelevant.
export async function applyCollabUpdate(
  workspaceId: string,
  documentId: string,
  userId: string,
  body: { update: string },
) {
  assertCoeditingOn();
  await loadDocument(workspaceId, documentId, userId, { need: "edit" });
  const update = readUpdate(body.update);
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ state: documentCollabStateTable.state })
      .from(documentCollabStateTable)
      .where(eq(documentCollabStateTable.documentId, documentId))
      .for("update");
    if (!row) {
      throw new ApiError(409, {
        code: "COEDIT_NOT_SEEDED",
        message: "This document has no co-editing state yet: seed it first",
      });
    }
    await tx
      .update(documentCollabStateTable)
      .set({
        state: Buffer.from(Y.mergeUpdates([row.state, update])),
        updatedAt: new Date(),
      })
      .where(eq(documentCollabStateTable.documentId, documentId));
  });
  // The sender's other tabs need it too; Yjs ignores what a doc already has.
  await tellReaders({
    workspaceId,
    documentId,
    message: {
      type: "DOCUMENT_COLLAB_UPDATE",
      workspaceId,
      documentId,
      update: toBase64(update),
    },
  });
  return { applied: true };
}
