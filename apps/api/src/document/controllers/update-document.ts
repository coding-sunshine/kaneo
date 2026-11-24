import { eq } from "drizzle-orm";
import type { z } from "zod";
import db from "../../database";
import { documentTable } from "../../database/schema";
import type { updateDocumentBody } from "../schema";
import { getDocument } from "./get-document";
import { assertNotSuperseded } from "./assert-not-superseded";
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
  assertNotSuperseded(doc);
  const title = body.title ?? doc.title;
  const content = body.content ?? doc.content;
  const textChanged = title !== doc.title || content !== doc.content;

  await db
    .update(documentTable)
    .set({
      title,
      content,
      ...(body.icon !== undefined && { icon: body.icon }),
      ...(body.color !== undefined && { color: body.color }),
      ...(body.generalAccess && { generalAccess: body.generalAccess }),
      ...(body.kind && { kind: body.kind }),
      // "Edited" in the header tracks text, not settings.
      ...(textChanged && { updatedAt: new Date(), updatedById: userId }),
    })
    .where(eq(documentTable.id, id));
  if (textChanged) {
    await recordVersion(id, userId, { title, content });
    await notifyBodyMentions({ ...doc, title }, userId, doc.content, content);
  }
  return getDocument(workspaceId, id, userId);
}
