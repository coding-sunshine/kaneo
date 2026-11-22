import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function getIssueTemplates({ projectId }: { projectId: string }) {
  const response = await client["issue-template"].project[":projectId"].$get({
    param: { projectId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getIssueTemplates;
