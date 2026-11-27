import db from "../../database";
import { documentTemplateTable } from "../../database/schema";
import { loadDocument } from "../../document/controllers/load-document";

// Copies a page the person can open into a template for the workspace.
export async function saveTemplate(
  workspaceId: string,
  userId: string,
  body: { documentId: string; name?: string },
) {
  const doc = await loadDocument(workspaceId, body.documentId, userId);
  const [created] = await db
    .insert(documentTemplateTable)
    .values({
      workspaceId,
      name: body.name ?? (doc.title.trim() || "Untitled"),
      title: doc.title,
      content: doc.content,
      creatorId: userId,
    })
    .returning();
  if (!created) throw new Error("Document template insert returned no row");
  return created;
}
