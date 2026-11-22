import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function getWorkspaceWebhooks(workspaceId: string) {
  const response = await client["workspace-webhook"].workspace[
    ":workspaceId"
  ].$get({ param: { workspaceId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
