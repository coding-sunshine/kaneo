import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

const route = client.agent.workspace[":workspaceId"]["ai-destination"];

export async function getAiDestination(workspaceId: string) {
  const response = await route.$get({ param: { workspaceId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export type AiDestination = Awaited<ReturnType<typeof getAiDestination>>;
export type AiDestinationChoice =
  | { provider: "openrouter" }
  | { provider: "self-hosted"; model: string };

export async function setAiDestination(
  workspaceId: string,
  choice: AiDestinationChoice,
) {
  const response = await route.$put({ param: { workspaceId }, json: choice });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
