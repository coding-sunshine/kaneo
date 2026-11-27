import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function getEmailIntake(projectId: string) {
  const response = await client["email-intake"].project[":projectId"].$get({
    param: { projectId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export default getEmailIntake;
