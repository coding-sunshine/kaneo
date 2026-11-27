import { and, asc, eq, isNull } from "drizzle-orm";
import db from "../../database";
import { documentTable } from "../../database/schema";
import { documentVisibility } from "../visibility";

/**
 * Every page the reader can open, with the page it sits under. A page whose
 * parent the reader cannot open shows at the top, and the parent stays
 * unnamed.
 */
export async function pageTree(workspaceId: string, userId: string) {
  const pages = await db
    .select({
      id: documentTable.id,
      title: documentTable.title,
      icon: documentTable.icon,
      parentDocumentId: documentTable.parentDocumentId,
    })
    .from(documentTable)
    .where(
      and(
        eq(documentTable.workspaceId, workspaceId),
        isNull(documentTable.deletedAt),
        documentVisibility(userId, documentTable),
      ),
    )
    .orderBy(asc(documentTable.title), asc(documentTable.id));
  const open = new Set(pages.map((page) => page.id));
  return pages.map((page) => ({
    ...page,
    parentDocumentId:
      page.parentDocumentId && open.has(page.parentDocumentId)
        ? page.parentDocumentId
        : null,
  }));
}
