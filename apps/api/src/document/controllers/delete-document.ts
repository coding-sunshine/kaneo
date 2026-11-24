import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { documentTable } from "../../database/schema";
import { getDocument } from "./get-document";
import { loadDocument } from "./load-document";

export async function deleteDocument(
  workspaceId: string,
  id: string,
  userId: string,
) {
  const doc = await loadDocument(workspaceId, id, userId, { need: "edit" });
  if (doc.status === "current") {
    throw new HTTPException(409, {
      message:
        "This is the current document on its topic. Make another one current first.",
    });
  }
  await db
    .update(documentTable)
    .set({ deletedAt: new Date() })
    .where(eq(documentTable.id, id));
  return { id };
}

export async function restoreDocument(
  workspaceId: string,
  id: string,
  userId: string,
) {
  await loadDocument(workspaceId, id, userId, { need: "edit", deleted: true });
  await db
    .update(documentTable)
    .set({ deletedAt: null })
    .where(eq(documentTable.id, id));
  return getDocument(workspaceId, id, userId);
}
