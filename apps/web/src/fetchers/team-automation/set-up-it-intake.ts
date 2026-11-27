import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function setUpItIntake(projectId: string) {
  const response = await client["team-automation"]["it-intake"][
    ":projectId"
  ].$post({ param: { projectId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export default setUpItIntake;
