import { and, eq } from "drizzle-orm";
import db, { schema } from "../../database";
import { isWorkspaceGuest } from "../../guest/is-workspace-guest";
import { roleHasWorkspacePermission } from "../../utils/require-workspace-permission";

/**
 * Whether the person may post an update to the workspace's projects, as the
 * update route allows: no guest (projects are hidden from them) and a role
 * that can update tasks (a viewer cannot).
 */
export async function canPostProjectUpdate(
  workspaceId: string,
  userId: string,
) {
  if (await isWorkspaceGuest(workspaceId, userId)) return false;
  const [member] = await db
    .select({ role: schema.workspaceUserTable.role })
    .from(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.workspaceId, workspaceId),
        eq(schema.workspaceUserTable.userId, userId),
      ),
    )
    .limit(1);
  return member
    ? roleHasWorkspacePermission(workspaceId, member.role, {
        task: ["update"],
      })
    : false;
}
