import { sql } from "drizzle-orm";
import db from "../../database";
import { documentCollabStateTable } from "../../database/schema";
import { ApiError } from "../../errors/api-error";
import { loadDocument } from "../controllers/load-document";
import { documentChanged } from "../controllers/update-document";
import { tellReaders } from "../reader-hint";
import { assertCoeditingOn } from "./coediting-config";
import { readUpdate } from "./yjs-update";

// The first editor to open a document builds its state from the text. Two
// who open it together race on the row: one seeds, the other loads.
export async function seedCollab(
  workspaceId: string,
  documentId: string,
  userId: string,
  body: { update: string; baseHash: string },
) {
  assertCoeditingOn();
  const doc = await loadDocument(workspaceId, documentId, userId, {
    need: "edit",
  });
  if ((doc.contentHash ?? "") !== body.baseHash) documentChanged();
  const state = Buffer.from(readUpdate(body.update));
  const [seeded] = await db
    .insert(documentCollabStateTable)
    .values({ documentId, state, seededHash: body.baseHash })
    .onConflictDoUpdate({
      target: documentCollabStateTable.documentId,
      set: {
        state: sql`excluded.state`,
        seededHash: sql`excluded.seeded_hash`,
        updatedAt: sql`(now() AT TIME ZONE 'utc')`,
      },
      // Only a state made from an older text gives way.
      setWhere: sql`${documentCollabStateTable.seededHash} <> excluded.seeded_hash`,
    })
    .returning({ documentId: documentCollabStateTable.documentId });
  if (!seeded) {
    throw new ApiError(409, {
      code: "COEDIT_SEEDED",
      message: "Someone else started co-editing this text: load their state",
    });
  }
  // Editors still on a state made from older text start over from this one.
  await tellReaders({
    workspaceId,
    documentId,
    exceptUserId: userId,
    message: { type: "DOCUMENT_COLLAB_RESET", workspaceId, documentId },
  });
  return { applied: true };
}
