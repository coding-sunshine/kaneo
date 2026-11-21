import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { type DocumentAccess, documentShareTable } from "../../database/schema";
import { filterAssignableUsers } from "../../utils/assert-assignable-user";
import { getDocument } from "./get-document";
import { loadDocument } from "./load-document";

export async function shareDocument(
  workspaceId: string,
  id: string,
  userId: string,
  targetUserId: string,
  access: DocumentAccess,
) {
  const doc = await loadDocument(workspaceId, id, userId, { need: "edit" });
  if (targetUserId === doc.creatorId) {
    throw new HTTPException(400, { message: "The owner always has access" });
  }
  const members = await filterAssignableUsers([targetUserId], workspaceId);
  if (!members.has(targetUserId)) {
    throw new HTTPException(400, {
      message: "Only workspace members can be invited",
    });
  }
  await db
    .insert(documentShareTable)
    .values({ documentId: id, userId: targetUserId, access })
    .onConflictDoUpdate({
      target: [documentShareTable.documentId, documentShareTable.userId],
      set: { access },
    });
  return getDocument(workspaceId, id, userId);
}

// Editors remove anyone; everyone may remove themselves.
export async function unshareDocument(
  workspaceId: string,
  id: string,
  userId: string,
  targetUserId: string,
) {
  await loadDocument(workspaceId, id, userId, {
    need: targetUserId === userId ? "view" : "edit",
  });
  await db
    .delete(documentShareTable)
    .where(
      and(
        eq(documentShareTable.documentId, id),
        eq(documentShareTable.userId, targetUserId),
      ),
    );
  return { id };
}
