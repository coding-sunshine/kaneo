import { eq } from "drizzle-orm";
import type { z } from "zod";
import db from "../../database";
import {
  type DocumentScope,
  documentSubscriberTable,
  documentTable,
} from "../../database/schema";
import { fingerprint } from "../fingerprint";
import { syncDocumentReferences } from "../../reference/sync-references";
import { syncDocumentTaskLinks } from "../../task-document/sync-links";
import type { createDocumentBody } from "../schema";
import { copyLinkedFiles } from "./copy-linked-files";
import { getDocument } from "./get-document";
import { proposeLineage } from "./lineage";
import { loadHoldingPage } from "./move-page";
import { recordVersion } from "./record-version";
import { resolveParent } from "./resolve-parent";

// `scope` is for server-side callers; the route places a page by its parent.
export async function createDocument(
  userId: string,
  body: z.infer<typeof createDocumentBody> & { scope?: DocumentScope },
) {
  // A page made under another one lives in that page's place, unless the
  // request names a place of its own.
  const holder = body.parentDocumentId
    ? await loadHoldingPage(body.workspaceId, body.parentDocumentId, userId)
    : null;
  const named = body.projectId || body.workProjectId || body.taskId;
  const parent = await resolveParent(
    body.workspaceId,
    userId,
    holder && !named ? holder : body,
  );
  const title = body.title ?? "";
  const written = body.content ?? "";
  let prints = fingerprint(written);
  const [created] = await db
    .insert(documentTable)
    .values({
      workspaceId: body.workspaceId,
      title,
      content: written,
      fingerprint: prints,
      icon: body.icon ?? null,
      color: body.color ?? null,
      ...parent,
      parentDocumentId: holder?.id ?? null,
      creatorId: userId,
      updatedById: userId,
    })
    .returning({
      id: documentTable.id,
      workspaceId: documentTable.workspaceId,
      createdAt: documentTable.createdAt,
    });
  if (!created) throw new Error("Document insert returned no row");
  // The copies need the document's row, so the text is written twice.
  const content = await copyLinkedFiles(db, created, userId, written);
  if (content !== written) {
    prints = fingerprint(content);
    await db
      .update(documentTable)
      .set({ content, fingerprint: prints })
      .where(eq(documentTable.id, created.id));
  }

  // Linear subscribes the creator automatically.
  await db
    .insert(documentSubscriberTable)
    .values({ documentId: created.id, userId });
  if (title || content) {
    await recordVersion(created.id, userId, { title, content });
  }
  if (content) {
    await proposeLineage(created, prints, userId);
    await syncDocumentTaskLinks(db, created, userId, content);
    await syncDocumentReferences(db, created.id, content);
  }
  return getDocument(body.workspaceId, created.id, userId);
}
