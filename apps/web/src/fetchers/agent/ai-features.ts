import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

const route = client.agent.workspace[":workspaceId"]["ai-features"];

export async function getAiFeatures(workspaceId: string) {
  const response = await route.$get({ param: { workspaceId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export type AiFeatures = Awaited<ReturnType<typeof getAiFeatures>>;

export async function setAiFeatures(workspaceId: string, json: AiFeatures) {
  const response = await route.$put({ param: { workspaceId }, json });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
