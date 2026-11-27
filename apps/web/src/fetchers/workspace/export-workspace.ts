import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

/** The workspace export zip. Admins and owners only; the API refuses others. */
export async function exportWorkspace(workspaceId: string) {
  const response = await client["workspace-export"][":workspaceId"].$get({
    param: { workspaceId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.blob();
}
