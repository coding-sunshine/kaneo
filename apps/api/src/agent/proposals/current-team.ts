import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  type agentProposalTable,
  projectTable,
  taskTable,
} from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";

type Proposal = Pick<
  typeof agentProposalTable.$inferSelect,
  "taskId" | "projectId" | "arguments"
>;

/**
 * The team the proposal's ticket is in now. The person must be able to open
 * it, and the team a move would put the ticket in; otherwise the proposal
 * answers like an unknown one, naming nothing.
 */
export async function currentTeam(
  userId: string,
  workspaceId: string,
  proposal: Proposal,
) {
  const notFound = new HTTPException(404, { message: "Proposal not found" });
  let projectId = proposal.projectId;
  if (proposal.taskId) {
    const [task] = await db
      .select({ projectId: taskTable.projectId })
      .from(taskTable)
      .where(eq(taskTable.id, proposal.taskId));
    if (!task) throw notFound;
    projectId = task.projectId;
  }
  const target = proposal.arguments.projectId;
  const ids = [
    ...new Set([projectId, ...(typeof target === "string" ? [target] : [])]),
  ];
  const open = await db
    .select({ id: projectTable.id })
    .from(projectTable)
    .where(
      and(
        inArray(projectTable.id, ids),
        eq(projectTable.workspaceId, workspaceId),
        projectAccessCondition(userId, projectTable.id),
      ),
    );
  if (open.length !== ids.length) throw notFound;
  return projectId;
}
