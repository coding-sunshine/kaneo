import { eq } from "drizzle-orm";
import db from "../../database";
import { documentTable } from "../../database/schema";
import { getDocument } from "./get-document";
import { loadDocument } from "./load-document";

export async function deleteDocument(
  workspaceId: string,
  id: string,
  userId: string,
) {
  await loadDocument(workspaceId, id, userId, { need: "edit" });
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
