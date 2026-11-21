import { and, eq } from "drizzle-orm";
import db from "../../database";
import { projectMemberPreferenceTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { toTeamMembership } from "../team-membership";

type Changes = {
  joined?: boolean;
  notifyIssueAdded?: boolean;
  notifyIssueClosed?: boolean;
  notifyIssueTriage?: boolean;
};

const UNSUBSCRIBED = {
  notifyIssueAdded: false,
  notifyIssueClosed: false,
  notifyIssueTriage: false,
};

/** The caller's own team membership; nobody can move another person in or out. */
async function updateTeamMembership(
  workspaceId: string,
  projectId: string,
  userId: string,
  { joined, ...subscriptions }: Changes,
) {
  const where = and(
    eq(projectMemberPreferenceTable.projectId, projectId),
    eq(projectMemberPreferenceTable.userId, userId),
  );
  const [current] = await db
    .select()
    .from(projectMemberPreferenceTable)
    .where(where);
  const values = {
    ...(joined === undefined ? {} : { leftAt: joined ? null : new Date() }),
    // Leaving a team ends its notifications too.
    ...(joined === false ? UNSUBSCRIBED : subscriptions),
  };
  if (Object.keys(values).length === 0) return toTeamMembership(current);
  const [row] = await db
    .insert(projectMemberPreferenceTable)
    .values({ projectId, userId, ...values })
    .onConflictDoUpdate({
      target: [
        projectMemberPreferenceTable.projectId,
        projectMemberPreferenceTable.userId,
      ],
      set: values,
    })
    .returning();

  const wasJoined = !current?.leftAt;
  if (joined !== undefined && joined !== wasJoined)
    await publishEvent("project_members.updated", {
      workspaceId,
      projectIds: [projectId],
    });

  return toTeamMembership(row);
}

export default updateTeamMembership;
