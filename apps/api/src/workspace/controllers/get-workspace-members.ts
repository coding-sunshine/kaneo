import { and, eq, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { isWorkspaceGuest } from "../../guest/is-workspace-guest";
import { sharesProjectCondition } from "../../guest/shares-project-condition";
import {
  projectMemberPreferenceTable,
  userProfileTable,
  userTable,
  workspaceUserTable,
} from "../../database/schema";
import { hideClosedTeams } from "../../project-access/hide-closed-teams";
import { findWorkspaceProjectIds } from "../../project-access/find-workspace-project-ids";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { profileColumns } from "../../user/profile/profile-columns";
import { visibleProfile } from "../../user/profile/visible-profile";

async function getWorkspaceMembers(request: {
  workspaceId: string;
  userId: string;
  projectId?: string;
}) {
  const { workspaceId, projectId } = request;

  if (projectId) {
    const [known] = await findWorkspaceProjectIds(workspaceId, [projectId]);
    if (!known) {
      throw new HTTPException(404, { message: "Project not found" });
    }
    await hideClosedTeams(
      request.userId,
      projectId,
      () => new HTTPException(404, { message: "Project not found" }),
    );
  }
  // A guest sees only the people of their own projects, and not their
  // email addresses: name and avatar are enough to work together.
  const guest = await isWorkspaceGuest(workspaceId, request.userId);

  const members = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      image: userTable.image,
      role: workspaceUserTable.role,
      leftAt: projectMemberPreferenceTable.leftAt,
      ...profileColumns,
    })
    .from(workspaceUserTable)
    .innerJoin(userTable, eq(workspaceUserTable.userId, userTable.id))
    .leftJoin(userProfileTable, eq(userProfileTable.userId, userTable.id))
    .leftJoin(
      projectMemberPreferenceTable,
      and(
        eq(projectMemberPreferenceTable.userId, workspaceUserTable.userId),
        // No project means no match, so leftAt stays null.
        projectId
          ? eq(projectMemberPreferenceTable.projectId, projectId)
          : isNull(projectMemberPreferenceTable.projectId),
      ),
    )
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        projectId
          ? projectAccessCondition(workspaceUserTable.userId, projectId)
          : undefined,
        guest
          ? sharesProjectCondition(
              request.userId,
              workspaceUserTable.userId,
              workspaceId,
            )
          : undefined,
      ),
    );

  const now = new Date();
  return members.map(({ id, name, image, role, leftAt, email, ...profile }) => {
    const member = {
      id,
      name,
      image,
      role,
      email: guest && id !== request.userId ? "" : email,
      profile: visibleProfile(profile, now),
    };
    return projectId ? { ...member, joinedTeam: !leftAt } : member;
  });
}

export default getWorkspaceMembers;
