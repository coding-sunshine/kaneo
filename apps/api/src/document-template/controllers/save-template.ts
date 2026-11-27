import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { documentTemplateTable } from "../../database/schema";
import { loadDocument } from "../../document/controllers/load-document";

// Copies a page into a template every member of the workspace lists. Only a
// page already open to the whole workspace qualifies: a team, issue, project
// or private page would show its text to members who cannot open it.
export async function saveTemplate(
  workspaceId: string,
  userId: string,
  body: { documentId: string; name?: string },
) {
  const doc = await loadDocument(workspaceId, body.documentId, userId);
  if (doc.scope !== "workspace") {
    throw new HTTPException(403, {
      message:
        "Only a page open to the whole workspace can become a template. Move it to the workspace first.",
    });
  }
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
