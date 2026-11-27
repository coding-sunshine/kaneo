import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function parseFilter(
  workspaceId: string,
  projectId: string,
  text: string,
) {
  const response = await client.agent.workspace[
    ":workspaceId"
  ].filters.parse.$post({ param: { workspaceId }, json: { projectId, text } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
