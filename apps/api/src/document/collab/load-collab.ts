import { eq } from "drizzle-orm";
import db from "../../database";
import { documentCollabStateTable } from "../../database/schema";
import { loadDocument } from "../controllers/load-document";
import { assertCoeditingOn } from "./coediting-config";
import { toBase64 } from "./yjs-update";

// A state made from another text than the current one is not served: the
// text changed outside co-editing (a restore, an assistant, SQL).
export async function loadCollab(
  workspaceId: string,
  documentId: string,
  userId: string,
) {
  assertCoeditingOn();
  const doc = await loadDocument(workspaceId, documentId, userId);
  const contentHash = doc.contentHash ?? "";
  const [row] = await db
    .select()
    .from(documentCollabStateTable)
    .where(eq(documentCollabStateTable.documentId, documentId));
  const fresh = row && row.seededHash === contentHash;
  return {
    state: fresh ? toBase64(row.state) : null,
    contentHash,
    content: fresh ? null : doc.content,
  };
}
