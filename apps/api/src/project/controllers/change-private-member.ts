import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  projectTable,
  workspaceMemberProjectTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { findInaccessibleProjectIds } from "../../project-access/find-inaccessible-project-ids";
import { grantProjectToRestrictedMember } from "../../project-access/grant-project-to-restricted-member";
import { listPrivateProjectMembers } from "../../project-access/list-private-project-members";
import { lockAccessChange } from "../../project-access/lock-access-change";
import { unassignProjectOutsiders } from "../../project-access/unassign-project-outsiders";

/**
 * Adds a workspace member to a private team, or removes them from it. Removing
 * someone unassigns their issues in the team. A person may remove themselves;
 * the answer then lists nobody, because they can no longer open the team.
 */
export async function changePrivateMember(change: {
  workspaceId: string;
  projectId: string;
  actorId: string;
  userId: string;
  member: boolean;
}) {
  const { workspaceId, projectId, actorId, userId } = change;
  const result = await db.transaction(async (tx) => {
    // Member rows before the team row, the order every access change takes.
    const lock = await lockAccessChange(tx, { workspaceId, actorId, userId });
    if (!lock.actorAllowed) {
      throw new HTTPException(403, {
        message: "Changing who can open a team requires member:update",
      });
    }
    if (lock.targetRole === null) {
      throw new HTTPException(404, { message: "Member not found" });
    }
    const [team] = await tx
      .select({ isPrivate: projectTable.isPrivate })
      .from(projectTable)
      .where(
        and(
          eq(projectTable.id, projectId),
          eq(projectTable.workspaceId, workspaceId),
        ),
      )
      .for("update");
    if (!team) throw new HTTPException(404, { message: "Project not found" });
    if (!team.isPrivate) {
      throw new HTTPException(400, { message: "This team isn't private" });
    }
    // The caller may have lost the team since the route checked.
    if ((await findInaccessibleProjectIds(actorId, [projectId], tx)).length) {
      throw new HTTPException(403, {
        message: "You don't have access to this project",
      });
    }

    let unassigned = false;
    if (change.member) {
      await grantProjectToRestrictedMember(tx, {
        workspaceId,
        userId,
        projectId,
      });
    } else {
      await tx
        .delete(workspaceMemberProjectTable)
        .where(
          and(
            eq(workspaceMemberProjectTable.workspaceId, workspaceId),
            eq(workspaceMemberProjectTable.userId, userId),
            eq(workspaceMemberProjectTable.projectId, projectId),
          ),
        );
      unassigned =
        (await unassignProjectOutsiders(tx, { projectId, actorId })).length > 0;
    }
    const [roster] = await listPrivateProjectMembers(
      workspaceId,
      actorId,
      tx,
      projectId,
    );
    return { roster: roster ?? { projectId, userIds: [] }, unassigned };
  });

  await publishEvent("project_access.updated", {
    workspaceId,
    userId,
    projectIds: [projectId],
  });
  if (result.unassigned) {
    await publishEvent("task.bulk_unassigned", { projectId, userId: actorId });
  }
  return result.roster;
}
