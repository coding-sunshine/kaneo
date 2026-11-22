import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function getTriageResponsibility(projectId: string) {
  const response = await client["team-automation"].triage[":projectId"].$get({
    param: { projectId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export default getTriageResponsibility;
