import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import {
  projectTable,
  workProjectMilestoneTable,
  workProjectTable,
} from "../database/schema";

// A task may join a project of its own workspace, and a milestone of that project.
export async function assertTaskWorkProject(
  teamId: string,
  workProjectId: string | null | undefined,
  milestoneId: string | null | undefined,
) {
  if (!workProjectId) {
    if (milestoneId)
      throw new HTTPException(400, {
        message: "A milestone needs a project",
      });
    return;
  }
  const [row] = await db
    .select({ id: workProjectTable.id })
    .from(workProjectTable)
    .innerJoin(
      projectTable,
      eq(projectTable.workspaceId, workProjectTable.workspaceId),
    )
    .where(
      and(eq(workProjectTable.id, workProjectId), eq(projectTable.id, teamId)),
    )
    .limit(1);
  if (!row) throw new HTTPException(404, { message: "Project not found" });
  if (!milestoneId) return;
  const [milestone] = await db
    .select({ id: workProjectMilestoneTable.id })
    .from(workProjectMilestoneTable)
    .where(
      and(
        eq(workProjectMilestoneTable.id, milestoneId),
        eq(workProjectMilestoneTable.workProjectId, workProjectId),
      ),
    )
    .limit(1);
  if (!milestone)
    throw new HTTPException(404, { message: "Milestone not found" });
}
