import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

/** Turns the team's email intake on (keeping its address) or off. */
async function setEmailIntake(projectId: string, enabled: boolean) {
  const route = client["email-intake"].project[":projectId"];
  const request = { param: { projectId } };
  const response = enabled
    ? await route.$put(request)
    : await route.$delete(request);
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export default setEmailIntake;
