import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

const workspace = client.agent.workspace[":workspaceId"];

export async function getCodingAgent(workspaceId: string) {
  const response = await workspace["coding-agent"].$get({
    param: { workspaceId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function delegateTask(workspaceId: string, taskId: string) {
  const response = await workspace.tasks[":taskId"].delegate.$post({
    param: { workspaceId, taskId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function getTaskDelegations(workspaceId: string, taskId: string) {
  const response = await workspace.tasks[":taskId"].delegations.$get({
    param: { workspaceId, taskId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export type CodingAgentRun = Awaited<
  ReturnType<typeof getTaskDelegations>
>[number];
