import type { z } from "zod";
import db from "../../database";
import { documentSubscriberTable, documentTable } from "../../database/schema";
import type { createDocumentBody } from "../schema";
import { getDocument } from "./get-document";
import { recordVersion } from "./record-version";
import { resolveParent } from "./resolve-parent";

export async function createDocument(
  userId: string,
  body: z.infer<typeof createDocumentBody>,
) {
  const parent = await resolveParent(body.workspaceId, userId, body);
  const title = body.title ?? "";
  const content = body.content ?? "";
  const [created] = await db
    .insert(documentTable)
    .values({
      workspaceId: body.workspaceId,
      title,
      content,
      icon: body.icon ?? null,
      color: body.color ?? null,
      ...parent,
      creatorId: userId,
      updatedById: userId,
    })
    .returning({ id: documentTable.id });
  if (!created) throw new Error("Document insert returned no row");

  // Linear subscribes the creator automatically.
  await db
    .insert(documentSubscriberTable)
    .values({ documentId: created.id, userId });
  if (title || content) {
    await recordVersion(created.id, userId, { title, content });
  }
  return getDocument(body.workspaceId, created.id, userId);
}
