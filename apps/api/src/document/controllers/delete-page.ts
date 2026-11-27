import { and, eq, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { documentTable } from "../../database/schema";
import { deleteDocument } from "./delete-document";
import { loadDocument } from "./load-document";

export type ChildPages = "lift" | "delete";

const childrenOf = (id: string) =>
  db
    .select({ id: documentTable.id })
    .from(documentTable)
    .where(
      and(
        eq(documentTable.parentDocumentId, id),
        isNull(documentTable.deletedAt),
      ),
    );

const putUnder = (id: string, parentDocumentId: string | null) =>
  db
    .update(documentTable)
    .set({ parentDocumentId })
    .where(eq(documentTable.id, id));

/**
 * Moves a page to the trash. A page with pages under it needs a choice: lift
 * them to where the page was, or delete them too. Deleting them stops at a
 * page the person may not delete: it moves up instead, with what is under it.
 */
export async function deletePage(
  workspaceId: string,
  id: string,
  userId: string,
  children?: ChildPages,
) {
  const page = await loadDocument(workspaceId, id, userId, { need: "edit" });
  const below = await childrenOf(id);
  if (below.length && !children) {
    throw new HTTPException(409, {
      message:
        "This page has pages under it. Choose to move them up or delete them too",
    });
  }
  await deleteDocument(workspaceId, id, userId);
  const keepUnder = page.parentDocumentId;
  const alsoDeleted: string[] = [];
  if (children !== "delete") {
    for (const child of below) await putUnder(child.id, keepUnder);
    return { id, alsoDeleted };
  }
  const queue = below.map((child) => child.id);
  for (let next = queue.shift(); next; next = queue.shift()) {
    try {
      await deleteDocument(workspaceId, next, userId);
    } catch (error) {
      if (!(error instanceof HTTPException)) throw error;
      await putUnder(next, keepUnder);
      continue;
    }
    alsoDeleted.push(next);
    queue.push(...(await childrenOf(next)).map((child) => child.id));
  }
  return { id, alsoDeleted };
}
