import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import db from "../../database";
import { documentShareTable, documentTable } from "../../database/schema";
import type { moveDocumentBody } from "../schema";
import { getDocument } from "./get-document";
import { loadDocument } from "./load-document";
import { resolveParent } from "./resolve-parent";

export async function moveDocument(
  workspaceId: string,
  id: string,
  userId: string,
  body: z.infer<typeof moveDocumentBody>,
) {
  const doc = await loadDocument(workspaceId, id, userId, { need: "edit" });
  if (body.scope === "private" && doc.role !== "owner") {
    throw new HTTPException(403, {
      message: "Only the creator can make a document private",
    });
  }
  const parent = await resolveParent(workspaceId, userId, body);

  await db.transaction(async (tx) => {
    await tx.update(documentTable).set(parent).where(eq(documentTable.id, id));
    // Back in My documents means private again: drop everyone invited.
    if (parent.scope === "private") {
      await tx
        .delete(documentShareTable)
        .where(eq(documentShareTable.documentId, id));
    }
  });
  if (body.scope === "private" || doc.role === "owner") {
    return getDocument(workspaceId, id, userId);
  }
  // A non-creator may lose sight of the document by moving it.
  return getDocument(workspaceId, id, userId).catch((error) => {
    if (error instanceof HTTPException && error.status === 404) {
      return null;
    }
    throw error;
  });
}
