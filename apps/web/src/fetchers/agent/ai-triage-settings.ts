import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

const route =
  client.agent.workspace[":workspaceId"].teams[":projectId"]["triage-settings"];

export async function getAiTriageSettings(
  workspaceId: string,
  projectId: string,
) {
  const response = await route.$get({ param: { workspaceId, projectId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export type AiTriageSettings = Awaited<ReturnType<typeof getAiTriageSettings>>;

export async function updateAiTriageSettings(
  workspaceId: string,
  projectId: string,
  json: AiTriageSettings,
) {
  const response = await route.$put({
    param: { workspaceId, projectId },
    json,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
