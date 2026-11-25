import { and, eq, ne, notExists } from "drizzle-orm";
import {
  calendarFeedTable,
  projectTable,
  workspaceMemberAccessTable,
  workspaceMemberProjectTable,
  workspaceUserTable,
} from "../../database/schema";
import type { DbOrTx } from "../../project-access/db-or-tx";
import { grantProjectToRestrictedMember } from "../../project-access/grant-project-to-restricted-member";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { unassignProjectOutsiders } from "../../project-access/unassign-project-outsiders";

type Change = {
  workspaceId: string;
  projectId: string;
  actorId: string;
  isPrivate: boolean;
};

async function membersWithAccess(database: DbOrTx, change: Change) {
  const rows = await database
    .select({ userId: workspaceUserTable.userId })
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.workspaceId, change.workspaceId),
        projectAccessCondition(workspaceUserTable.userId, change.projectId),
      ),
    );
  return new Set(rows.map((row) => row.userId));
}

/**
 * Makes a team private or opens it again. The caller holds the team row
 * locked, and has already been checked.
 *
 * Going private: people already limited to this team keep it, the caller
 * keeps it, everyone else loses it and their issues in the team are
 * unassigned. The team's calendar links are deleted, because a link is read
 * by whoever holds its address.
 *
 * Opening: rows held by people who are not limited to chosen teams are
 * deleted. They mean nothing on an open team, and must not put those people
 * back if the team is made private again.
 */
export async function changeProjectPrivacy(database: DbOrTx, change: Change) {
  const before = await membersWithAccess(database, change);
  await database
    .update(projectTable)
    .set({ isPrivate: change.isPrivate })
    .where(eq(projectTable.id, change.projectId));

  let unassigned = false;
  if (change.isPrivate) {
    await grantProjectToRestrictedMember(database, {
      workspaceId: change.workspaceId,
      userId: change.actorId,
      projectId: change.projectId,
    });
    unassigned = (await unassignProjectOutsiders(database, change)).length > 0;
    await database
      .delete(calendarFeedTable)
      .where(eq(calendarFeedTable.projectId, change.projectId));
  } else {
    await database.delete(workspaceMemberProjectTable).where(
      and(
        eq(workspaceMemberProjectTable.projectId, change.projectId),
        notExists(
          database
            .select({ userId: workspaceMemberAccessTable.userId })
            .from(workspaceMemberAccessTable)
            .where(
              and(
                eq(
                  workspaceMemberAccessTable.workspaceId,
                  workspaceMemberProjectTable.workspaceId,
                ),
                eq(
                  workspaceMemberAccessTable.userId,
                  workspaceMemberProjectTable.userId,
                ),
                ne(workspaceMemberAccessTable.projectAccess, "all"),
              ),
            ),
        ),
      ),
    );
  }

  const after = await membersWithAccess(database, change);
  return {
    unassigned,
    // Everyone whose list of teams just changed, so their open pages catch up.
    changedUserIds: [...new Set([...before, ...after])].filter(
      (userId) => before.has(userId) !== after.has(userId),
    ),
  };
}
