import { and, eq, inArray, isNull } from "drizzle-orm";
import db from "../database";
import { projectTable } from "../database/schema";
import { projectAccessCondition } from "../project-access/project-access-condition";

/** Ids of the workspace's active projects the reader can open, among `ids` when given. */
export async function openProjectIds(
  workspaceId: string,
  userId: string,
  ids?: string[],
) {
  if (ids?.length === 0) return [];
  const rows = await db
    .select({ id: projectTable.id })
    .from(projectTable)
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        isNull(projectTable.archivedAt),
        projectAccessCondition(userId, projectTable.id),
        ids ? inArray(projectTable.id, ids) : undefined,
      ),
    );
  return rows.map((row) => row.id);
}
