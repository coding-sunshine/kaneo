import { and, eq } from "drizzle-orm";
import db from "../../database";
import { workspaceUserTable } from "../../database/schema";
import createNotification from "../../notification/controllers/create-notification";
import { workProjectName } from "../proposals/create-proposal";

/**
 * Tells the workspace's owners in their inbox that a weekly digest was
 * posted. It names the project only; the digest itself is on the project.
 */
export async function notifyDigestPosted(
  workspaceId: string,
  workProjectId: string,
  posterId: string,
) {
  const projectName = await workProjectName(workspaceId, workProjectId);
  if (!projectName) return;
  const owners = await db
    .select({ userId: workspaceUserTable.userId })
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        eq(workspaceUserTable.role, "owner"),
      ),
    );
  for (const { userId } of owners) {
    await createNotification({
      userId,
      type: "weekly_digest",
      title: null,
      content: projectName,
      eventData: { workspaceId, workProjectId, projectName, posterId },
      resourceId: workspaceId,
      resourceType: "workspace",
    });
  }
}
