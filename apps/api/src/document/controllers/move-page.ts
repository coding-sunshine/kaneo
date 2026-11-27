import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { documentTable } from "../../database/schema";
import { getDocument } from "./get-document";
import { loadDocument } from "./load-document";
import { pageChain } from "./page-ancestors";

/**
 * A page may hold another when the person can edit it, and when it is not
 * that page or one of the pages under it. Returns the holding page.
 */
export async function loadHoldingPage(
  workspaceId: string,
  parentDocumentId: string,
  userId: string,
  childId?: string,
) {
  const holder = await loadDocument(workspaceId, parentDocumentId, userId, {
    need: "edit",
  });
  if (childId && (await pageChain(workspaceId, holder.id)).includes(childId)) {
    throw new HTTPException(409, {
      message: "A page cannot go under itself or a page below it",
    });
  }
  return holder;
}

/** Puts a page under another one, or at the top with null. */
export async function movePage(
  workspaceId: string,
  id: string,
  userId: string,
  parentDocumentId: string | null,
) {
  await loadDocument(workspaceId, id, userId, { need: "edit" });
  if (parentDocumentId) {
    await loadHoldingPage(workspaceId, parentDocumentId, userId, id);
  }
  await db
    .update(documentTable)
    .set({ parentDocumentId })
    .where(eq(documentTable.id, id));
  return getDocument(workspaceId, id, userId);
}
