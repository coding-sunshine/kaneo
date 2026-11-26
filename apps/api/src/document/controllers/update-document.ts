import { eq } from "drizzle-orm";
import type { z } from "zod";
import db from "../../database";
import { documentTable } from "../../database/schema";
import { fingerprint } from "../fingerprint";
import { syncDocumentTaskLinks } from "../../task-document/sync-links";
import { carryStatements } from "../../topic/controllers/statements";
import type { updateDocumentBody } from "../schema";
import { getDocument } from "./get-document";
import { assertNotSuperseded } from "./assert-not-superseded";
import { proposeLineage } from "./lineage";
import { loadDocument } from "./load-document";
import { notifyBodyMentions } from "./notify";
import { recordVersion } from "./record-version";

export async function updateDocument(
  workspaceId: string,
  id: string,
  userId: string,
  body: z.infer<typeof updateDocumentBody>,
) {
  const doc = await loadDocument(workspaceId, id, userId, { need: "edit" });
  return writeDocument(doc, userId, body);
}

// The write itself, for a caller that has settled by a rule of its own that
// the user may make it. The user must still be able to open the document.
export async function writeDocument(
  doc: Awaited<ReturnType<typeof loadDocument>>,
  userId: string,
  body: z.infer<typeof updateDocumentBody>,
) {
  const { workspaceId, id } = doc;
  assertNotSuperseded(doc);
  const title = body.title ?? doc.title;
  const content = body.content ?? doc.content;
  const textChanged = title !== doc.title || content !== doc.content;
  const prints = content === doc.content ? null : fingerprint(content);

  const [written] = await db
    .update(documentTable)
    .set({
      title,
      content,
      ...(prints && { fingerprint: prints }),
      ...(body.icon !== undefined && { icon: body.icon }),
      ...(body.color !== undefined && { color: body.color }),
      ...(body.generalAccess && { generalAccess: body.generalAccess }),
      ...(body.kind && { kind: body.kind }),
      // "Edited" in the header tracks text, not settings.
      ...(textChanged && { updatedAt: new Date(), updatedById: userId }),
    })
    .where(eq(documentTable.id, id))
    // The hash of the new text, which a database trigger writes.
    .returning({ contentHash: documentTable.contentHash });
  if (textChanged) {
    await recordVersion(id, userId, { title, content });
    await notifyBodyMentions({ ...doc, title }, userId, doc.content, content);
  }
  if (prints) {
    await proposeLineage(doc, prints, userId);
    await syncDocumentTaskLinks(db, doc, userId, content);
    await carryStatements(
      id,
      doc.contentHash,
      written?.contentHash ?? null,
      doc.content,
      content,
    );
  }
  return getDocument(workspaceId, id, userId);
}
