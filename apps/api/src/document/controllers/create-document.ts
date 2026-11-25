import type { z } from "zod";
import db from "../../database";
import { documentSubscriberTable, documentTable } from "../../database/schema";
import { fingerprint } from "../fingerprint";
import type { createDocumentBody } from "../schema";
import { getDocument } from "./get-document";
import { proposeLineage } from "./lineage";
import { recordVersion } from "./record-version";
import { resolveParent } from "./resolve-parent";

export async function createDocument(
  userId: string,
  body: z.infer<typeof createDocumentBody>,
) {
  const parent = await resolveParent(body.workspaceId, userId, body);
  const title = body.title ?? "";
  const content = body.content ?? "";
  const prints = fingerprint(content);
  const [created] = await db
    .insert(documentTable)
    .values({
      workspaceId: body.workspaceId,
      title,
      content,
      fingerprint: prints,
      icon: body.icon ?? null,
      color: body.color ?? null,
      ...parent,
      creatorId: userId,
      updatedById: userId,
    })
    .returning({
      id: documentTable.id,
      workspaceId: documentTable.workspaceId,
      createdAt: documentTable.createdAt,
    });
  if (!created) throw new Error("Document insert returned no row");

  // Linear subscribes the creator automatically.
  await db
    .insert(documentSubscriberTable)
    .values({ documentId: created.id, userId });
  if (title || content) {
    await recordVersion(created.id, userId, { title, content });
  }
  if (content) await proposeLineage(created, prints, userId);
  return getDocument(body.workspaceId, created.id, userId);
}
