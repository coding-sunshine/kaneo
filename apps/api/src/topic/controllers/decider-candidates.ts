import { audienceOf } from "../../document/controllers/document-audience";
import { getTopic } from "./get-topic";

// The people who may be named decider or backup: everyone who can open the
// topic's place, the rule assertDeciders applies.
export async function deciderCandidates(
  workspaceId: string,
  id: string,
  userId: string,
) {
  const topic = await getTopic(workspaceId, id, userId);
  return audienceOf(workspaceId, {
    id: null,
    creatorId: null,
    scope: topic.scope,
    projectId: topic.projectId,
    workProjectId: topic.workProjectId,
    taskId: null,
  });
}
