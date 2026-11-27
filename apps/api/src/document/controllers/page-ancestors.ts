import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import db from "../../database";
import { documentTable } from "../../database/schema";
import { documentVisibility } from "../visibility";

// Deeper than any real wiki; stops a loop in bad data from running forever.
const MAX_DEPTH = 100;

/** The page and the pages above it, nearest first, whoever can open them. */
export async function pageChain(workspaceId: string, id: string) {
  const result = await db.execute<{ id: string }>(sql`
    WITH RECURSIVE chain(id, parent_id, depth) AS (
      SELECT id, parent_document_id, 0 FROM document
      WHERE id = ${id} AND workspace_id = ${workspaceId}
      UNION ALL
      SELECT above.id, above.parent_document_id, chain.depth + 1
      FROM document AS above
      JOIN chain ON above.id = chain.parent_id
      WHERE chain.depth < ${MAX_DEPTH} AND above.workspace_id = ${workspaceId}
    )
    SELECT id FROM chain ORDER BY depth
  `);
  return result.rows.map((row) => row.id);
}

/**
 * The breadcrumb above a page, top first. It ends below the first page the
 * reader cannot open, so a hidden page's title never shows.
 */
export async function pageAncestors(
  workspaceId: string,
  parentDocumentId: string | null,
  userId: string,
) {
  if (!parentDocumentId) return [];
  const chain = await pageChain(workspaceId, parentDocumentId);
  const open = await db
    .select({ id: documentTable.id, title: documentTable.title })
    .from(documentTable)
    .where(
      and(
        inArray(documentTable.id, chain),
        isNull(documentTable.deletedAt),
        documentVisibility(userId, documentTable),
      ),
    );
  const ancestors: { id: string; title: string }[] = [];
  for (const id of chain) {
    const page = open.find((row) => row.id === id);
    if (!page) break;
    ancestors.unshift(page);
  }
  return ancestors;
}

/** Whether any page, open to the reader or not, sits under this one. */
export async function hasChildPages(id: string) {
  const [child] = await db
    .select({ id: documentTable.id })
    .from(documentTable)
    .where(
      and(
        eq(documentTable.parentDocumentId, id),
        isNull(documentTable.deletedAt),
      ),
    )
    .limit(1);
  return Boolean(child);
}
