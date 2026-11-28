import { HTTPException } from "hono/http-exception";
import { recordProposal } from "../proposals/record-proposal";
import { codingAgentConfig, warnCodingAgentOff } from "./coding-agent-config";
import { DELEGATE_TOOL } from "./delegate-tool";
import { readableTask } from "./readable-task";

/**
 * Puts a delegation card on the ticket for the person who asked. Nothing is
 * sent to the coding agent until they accept it.
 */
export async function proposeDelegation(
  userId: string,
  workspaceId: string,
  taskId: string,
  prompt = "Delegate to the coding agent",
) {
  const agent = codingAgentConfig();
  if (!agent) {
    warnCodingAgentOff();
    throw new HTTPException(503, {
      message: "No coding agent is configured on this server",
    });
  }
  const task = await readableTask(userId, workspaceId, taskId);
  return recordProposal({
    workspaceId,
    userId,
    projectId: task.projectId,
    taskId: task.id,
    tool: DELEGATE_TOOL,
    arguments: { workspaceId, taskId: task.id },
    diff: [{ field: "agent", from: null, to: agent.name }],
    reason: `${agent.name} works on the ticket and opens a pull request; the ticket moves to In Progress.`,
    prompt,
    sources: [{ kind: "task", id: task.id }],
  });
}
