import type { agentProposalTable } from "../../database/schema";
import { askDecider } from "../decision/ask-decider";
import { DECISION_TOOL } from "../decision/decision-tool";
import { POST_DIGEST_TOOL } from "../digest/digest-tool";
import { notifyDigestPosted } from "../digest/notify-digest";

/** Who hears of an applied proposal: owners of a digest, deciders of a decision. */
export async function afterAccept(
  row: typeof agentProposalTable.$inferSelect,
  userId: string,
  result: string,
) {
  if (row.tool === POST_DIGEST_TOOL)
    await notifyDigestPosted(row.workspaceId, row.projectId, userId);
  if (row.tool === DECISION_TOOL)
    await askDecider(row.workspaceId, result, userId);
}
