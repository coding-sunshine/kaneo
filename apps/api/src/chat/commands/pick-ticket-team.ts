import { and, asc, eq, isNull } from "drizzle-orm";
import db from "../../database";
import { columnTable, projectTable } from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";

/**
 * Where /ticket files a ticket: the workspace's oldest active team the caller
 * can open, in its first column. Null when there is no such team.
 */
export async function pickTicketTeam(workspaceId: string, userId: string) {
  const [team] = await db
    .select({
      id: projectTable.id,
      slug: projectTable.slug,
      status: columnTable.slug,
    })
    .from(projectTable)
    .innerJoin(columnTable, eq(columnTable.projectId, projectTable.id))
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        isNull(projectTable.archivedAt),
        projectAccessCondition(userId, projectTable.id),
      ),
    )
    .orderBy(
      asc(projectTable.createdAt),
      asc(projectTable.id),
      asc(columnTable.position),
    )
    .limit(1);
  return team ?? null;
}
