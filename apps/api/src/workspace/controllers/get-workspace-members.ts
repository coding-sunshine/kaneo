import { and, eq, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { isWorkspaceGuest } from "../../guest/is-workspace-guest";
import { sharesProjectCondition } from "../../guest/shares-project-condition";
import {
  projectMemberPreferenceTable,
  userTable,
  workspaceUserTable,
} from "../../database/schema";
import { assertProjectAccess } from "../../project-access/assert-project-access";
import { findWorkspaceProjectIds } from "../../project-access/find-workspace-project-ids";
import { projectAccessCondition } from "../../project-access/project-access-condition";

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
    await assertProjectAccess(request.userId, projectId);
  }
  // A guest sees only the people of their own projects.
  const guest = await isWorkspaceGuest(workspaceId, request.userId);

  const members = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      image: userTable.image,
      role: workspaceUserTable.role,
      leftAt: projectMemberPreferenceTable.leftAt,
    })
    .from(workspaceUserTable)
    .innerJoin(userTable, eq(workspaceUserTable.userId, userTable.id))
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

  return members.map(({ leftAt, ...member }) =>
    projectId ? { ...member, joinedTeam: !leftAt } : member,
  );
}

export default getWorkspaceMembers;
