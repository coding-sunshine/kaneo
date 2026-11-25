import { HTTPException } from "hono/http-exception";
import { isWorkspaceOwner } from "./get-topic";

// The backup decider approves in the decider's absence and nothing more.
export async function assertTopicOwner(
  workspaceId: string,
  topic: { deciderId: string | null },
  userId: string,
) {
  if (
    topic.deciderId !== userId &&
    !(await isWorkspaceOwner(workspaceId, userId))
  ) {
    throw new HTTPException(403, {
      message: "Only the topic's decider or a workspace owner can change it",
    });
  }
}
