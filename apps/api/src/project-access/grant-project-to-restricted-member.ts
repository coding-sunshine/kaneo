import { eq } from "drizzle-orm";
import { schema } from "../database";
import type { DbOrTx } from "./db-or-tx";
import { projectAccessCondition } from "./project-access-condition";

/**
 * Keeps the person who made or moved a team in it: writes their row when the
 * team would otherwise be closed to them, because they are limited to chosen
 * teams or the team is private.
 */
export async function grantProjectToRestrictedMember(
  database: DbOrTx,
  grant: { workspaceId: string; userId: string; projectId: string },
): Promise<void> {
  const [project] = await database
    .select({
      open: projectAccessCondition(grant.userId, schema.projectTable.id),
    })
    .from(schema.projectTable)
    .where(eq(schema.projectTable.id, grant.projectId));
  if (!project || project.open) return;

  await database
    .insert(schema.workspaceMemberProjectTable)
    .values(grant)
    .onConflictDoNothing();
}
