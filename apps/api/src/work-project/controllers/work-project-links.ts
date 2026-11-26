import { and, asc, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { workProjectLinkTable } from "../../database/schema";

const select = {
  id: workProjectLinkTable.id,
  url: workProjectLinkTable.url,
  label: workProjectLinkTable.label,
  createdAt: workProjectLinkTable.createdAt,
};

export const listProjectLinks = (workProjectId: string) =>
  db
    .select(select)
    .from(workProjectLinkTable)
    .where(eq(workProjectLinkTable.workProjectId, workProjectId))
    .orderBy(
      asc(workProjectLinkTable.sortOrder),
      asc(workProjectLinkTable.createdAt),
      asc(workProjectLinkTable.id),
    );

export async function addProjectLink(
  workProjectId: string,
  userId: string,
  input: { url: string; label?: string },
) {
  const [last] = await db
    .select({
      sortOrder: sql<number>`coalesce(max(${workProjectLinkTable.sortOrder}), -1)::int`,
    })
    .from(workProjectLinkTable)
    .where(eq(workProjectLinkTable.workProjectId, workProjectId));
  const [created] = await db
    .insert(workProjectLinkTable)
    .values({
      workProjectId,
      userId,
      url: input.url,
      label: input.label ?? "",
      // A new link goes to the end of the row.
      sortOrder: (last?.sortOrder ?? -1) + 1,
    })
    .returning(select);
  if (!created) throw new HTTPException(500, { message: "Link not saved" });
  return created;
}

// The caller was checked against the project in the path, so a link is only
// removed through the project that holds it.
export async function removeProjectLink(workProjectId: string, id: string) {
  const [removed] = await db
    .delete(workProjectLinkTable)
    .where(
      and(
        eq(workProjectLinkTable.id, id),
        eq(workProjectLinkTable.workProjectId, workProjectId),
      ),
    )
    .returning({ id: workProjectLinkTable.id });
  if (!removed) throw new HTTPException(404, { message: "Link not found" });
  return removed;
}
