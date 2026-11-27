import { and, eq } from "drizzle-orm";
import db, { schema } from "../database";
import { clearMemberProjectAccess } from "./clear-member-project-access";
import type { InvitationProjectAccess } from "./invitation-project-access-type";
import { isOwnerRole } from "./is-owner-role";
import { replaceMemberProjectAccess } from "./replace-member-project-access";

export async function applyInvitationProjectAccess(
  invitation: InvitationProjectAccess,
  userId: string,
) {
  const guest = invitation.guest === true;
  const restricted =
    guest ||
    (invitation.projectAccess === "selected" && !isOwnerRole(invitation.role));
  const projectIds = Array.isArray(invitation.projectIds)
    ? invitation.projectIds.filter((id): id is string => typeof id === "string")
    : [];

  // A person who joins starts with no rows at all, so one left behind by an
  // earlier membership cannot put them back in a private team. A private team
  // named in the invitation is skipped by the replace below. A current member
  // who accepts an older invitation keeps the private teams they are in.
  await db.transaction(async (tx) => {
    const [member] = await tx
      .select({ id: schema.workspaceUserTable.id })
      .from(schema.workspaceUserTable)
      .where(
        and(
          eq(schema.workspaceUserTable.workspaceId, invitation.organizationId),
          eq(schema.workspaceUserTable.userId, userId),
        ),
      )
      .limit(1);
    if (!member) {
      await clearMemberProjectAccess(invitation.organizationId, userId, tx);
    }
    await replaceMemberProjectAccess(tx, {
      workspaceId: invitation.organizationId,
      userId,
      projectAccess: restricted ? "selected" : "all",
      projectIds,
    });
    // Written before the membership exists, so a guest is never a full
    // member, not even for a moment.
    if (guest) {
      const rules = schema.workspaceMemberAccessTable;
      await tx
        .update(rules)
        .set({ guest: true })
        .where(
          and(
            eq(rules.workspaceId, invitation.organizationId),
            eq(rules.userId, userId),
          ),
        );
    }
  });
}
