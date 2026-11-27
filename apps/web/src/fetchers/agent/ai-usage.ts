import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function getAiUsage(workspaceId: string) {
  const response = await client.agent.workspace[":workspaceId"].usage.$get({
    param: { workspaceId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export type AiUsage = Awaited<ReturnType<typeof getAiUsage>>;
export type AiBudget = AiUsage["budget"];

export async function setAiBudget(workspaceId: string, budget: AiBudget) {
  const response = await client.agent.workspace[":workspaceId"].budget.$put({
    param: { workspaceId },
    json: budget,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
