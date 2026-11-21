import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function getWorkProjects(workspaceId: string, teamId?: string) {
  const response = await client["work-project"].workspace[":workspaceId"].$get({
    param: { workspaceId },
    query: teamId ? { teamId } : {},
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export default getWorkProjects;
