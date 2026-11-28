import { eq } from "drizzle-orm";
import db from "../../database";
import { projectTable } from "../../database/schema";
import { subscribeToEvent } from "../../events";
import { isAgentEnabled } from "../openrouter";
import { codingAgentConfig } from "./coding-agent-config";
import { proposeDelegation } from "./propose-delegation";

/** The handle that hands a ticket over when a comment mentions it. */
export const codingAgentHandle = () =>
  process.env.CODING_AGENT_HANDLE?.trim() || "agent";

export function mentionsCodingAgent(content: string) {
  const handle = codingAgentHandle().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[\\s(>])@${handle}\\b`, "i").test(content);
}

// A comment that mentions the agent puts a delegation card on the ticket for
// its author; nothing is sent until they accept it.
subscribeToEvent<{
  taskId?: string;
  userId?: string | null;
  content?: string | null;
  projectId?: string;
}>("comment.created", async ({ taskId, userId, content, projectId }) => {
  if (!taskId || !userId || !projectId || !content) return;
  if (!isAgentEnabled() || !codingAgentConfig()) return;
  if (!mentionsCodingAgent(content)) return;
  const [team] = await db
    .select({ workspaceId: projectTable.workspaceId })
    .from(projectTable)
    .where(eq(projectTable.id, projectId));
  if (!team) return;
  await proposeDelegation(userId, team.workspaceId, taskId, content).catch(
    (error: unknown) => {
      console.error("Delegation from a mention failed:", error);
    },
  );
});
