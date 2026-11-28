import { and, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import db from "../../database";
import { documentCollabStateTable, documentTable } from "../../database/schema";
import { ApiError } from "../../errors/api-error";
import { fingerprint } from "../fingerprint";
import { syncDocumentReferences } from "../../reference/sync-references";
import { syncDocumentTaskLinks } from "../../task-document/sync-links";
import { carryStatements } from "../../topic/controllers/statements";
import type { updateDocumentBody } from "../schema";
import { getDocument } from "./get-document";
import { assertNotSuperseded } from "./assert-not-superseded";
import { copyLinkedFiles } from "./copy-linked-files";
import { proposeLineage } from "./lineage";
import { loadDocument } from "./load-document";
import { notifyBodyMentions } from "./notify";
import { recordVersion } from "./record-version";

// The client shows the newer text and lets its person decide.
export function documentChanged(): never {
  throw new ApiError(409, {
    code: "DOCUMENT_CHANGED",
    message: "Someone else saved this document since you opened it",
  });
}

export const isDocumentChanged = (error: unknown) =>
  error instanceof ApiError && error.code === "DOCUMENT_CHANGED";

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
  // From co-editing: the live state now stands for the new text.
  options: { coedited?: boolean } = {},
) {
  const { workspaceId, id } = doc;
  assertNotSuperseded(doc);
  const guardsContent =
    body.baseHash !== undefined &&
    body.content !== undefined &&
    body.content !== doc.content;
  if (guardsContent && (doc.contentHash ?? "") !== body.baseHash)
    documentChanged();
  const title = body.title ?? doc.title;
  const content =
    body.content === undefined || body.content === doc.content
      ? doc.content
      : await copyLinkedFiles(db, doc, userId, body.content);
  const textChanged = title !== doc.title || content !== doc.content;
  const prints = content === doc.content ? null : fingerprint(content);

  const write = (database: Pick<typeof db, "update">) =>
    database
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
      .where(
        and(
          eq(documentTable.id, id),
          // Compared in the write itself, so two saves cannot both pass it.
          guardsContent
            ? sql`coalesce(${documentTable.contentHash}, '') = ${body.baseHash}`
            : undefined,
        ),
      )
      // The hash of the new text, which a database trigger writes.
      .returning({ contentHash: documentTable.contentHash });
  const [written] = options.coedited
    ? await db.transaction(async (tx) => {
        const rows = await write(tx);
        if (rows[0])
          await tx
            .update(documentCollabStateTable)
            .set({ seededHash: rows[0].contentHash ?? "" })
            .where(eq(documentCollabStateTable.documentId, id));
        return rows;
      })
    : await write(db);
  if (guardsContent && !written) documentChanged();
  if (textChanged) {
    await recordVersion(id, userId, { title, content });
    await notifyBodyMentions({ ...doc, title }, userId, doc.content, content);
  }
  if (prints) {
    await proposeLineage(doc, prints, userId);
    await syncDocumentTaskLinks(db, doc, userId, content);
    await syncDocumentReferences(db, doc.id, content);
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
