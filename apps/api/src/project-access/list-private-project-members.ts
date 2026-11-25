import { and, eq } from "drizzle-orm";
import db, { schema } from "../database";
import type { DbOrTx } from "./db-or-tx";
import { projectAccessCondition } from "./project-access-condition";

/**
 * The private teams the viewer can open, each with the people who hold a row
 * for it. A private team the viewer cannot open is left out, so nothing says
 * it exists. The workspace owner and instance administrators hold no row and
 * are not listed: they can open every team.
 */
export async function listPrivateProjectMembers(
  workspaceId: string,
  viewerId: string,
  database: DbOrTx = db,
  projectId?: string,
) {
  const team = schema.projectTable;
  const grant = schema.workspaceMemberProjectTable;
  const member = schema.workspaceUserTable;
  const rows = await database
    .select({ projectId: team.id, userId: member.userId })
    .from(team)
    .leftJoin(
      grant,
      and(
        eq(grant.workspaceId, team.workspaceId),
        eq(grant.projectId, team.id),
      ),
    )
    // A row can outlive a membership; only current members are listed.
    .leftJoin(
      member,
      and(
        eq(member.workspaceId, grant.workspaceId),
        eq(member.userId, grant.userId),
      ),
    )
    .where(
      and(
        eq(team.workspaceId, workspaceId),
        eq(team.isPrivate, true),
        projectAccessCondition(viewerId, team.id),
        projectId === undefined ? undefined : eq(team.id, projectId),
      ),
    )
    .orderBy(team.id, member.userId);

  const teams = new Map<string, string[]>();
  for (const row of rows) {
    const userIds = teams.get(row.projectId) ?? [];
    if (row.userId) userIds.push(row.userId);
    teams.set(row.projectId, userIds);
  }
  return [...teams].map(([id, userIds]) => ({ projectId: id, userIds }));
}
