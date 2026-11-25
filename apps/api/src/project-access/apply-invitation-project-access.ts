import db from "../database";
import { clearMemberProjectAccess } from "./clear-member-project-access";
import type { InvitationProjectAccess } from "./invitation-project-access-type";
import { isOwnerRole } from "./is-owner-role";
import { replaceMemberProjectAccess } from "./replace-member-project-access";

export async function applyInvitationProjectAccess(
  invitation: InvitationProjectAccess,
  userId: string,
) {
  const restricted =
    invitation.projectAccess === "selected" && !isOwnerRole(invitation.role);
  const projectIds = Array.isArray(invitation.projectIds)
    ? invitation.projectIds.filter((id): id is string => typeof id === "string")
    : [];

  // A person who joins starts with no rows at all, so one left behind by an
  // earlier membership cannot put them back in a private team. A private team
  // named in the invitation is skipped by the replace below.
  await db.transaction(async (tx) => {
    await clearMemberProjectAccess(invitation.organizationId, userId, tx);
    await replaceMemberProjectAccess(tx, {
      workspaceId: invitation.organizationId,
      userId,
      projectAccess: restricted ? "selected" : "all",
      projectIds,
    });
  });
}
