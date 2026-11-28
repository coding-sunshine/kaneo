import { HTTPException } from "hono/http-exception";
import type { agentProposalTable } from "../../database/schema";
import { getTopic } from "../../topic/controllers/get-topic";
import { DECISION_TOOL } from "../decision/decision-tool";
import { POST_DIGEST_TOOL } from "../digest/digest-tool";
import { workProjectName } from "./create-proposal";
import { currentTeam } from "./current-team";
import { PROJECT_UPDATE_TOOL } from "./project-update-tool";

const POSTS_UPDATE: readonly string[] = [PROJECT_UPDATE_TOOL, POST_DIGEST_TOOL];

const notFound = () =>
  new HTTPException(404, { message: "Proposal not found" });

/**
 * Where an accepted proposal lands, checked again now: the project of an
 * update, the topic of a decision, else the ticket's team. Anything the
 * person can no longer open answers like an unknown proposal.
 */
export async function proposalPlace(
  userId: string,
  workspaceId: string,
  pending: typeof agentProposalTable.$inferSelect,
) {
  if (POSTS_UPDATE.includes(pending.tool)) {
    if (!(await workProjectName(workspaceId, pending.projectId)))
      throw notFound();
    return pending.projectId;
  }
  if (pending.tool === DECISION_TOOL) {
    await getTopic(workspaceId, pending.projectId, userId).catch(() => {
      throw notFound();
    });
    return pending.projectId;
  }
  return currentTeam(userId, workspaceId, pending);
}
