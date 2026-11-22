import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type TriageResponsibility = InferRequestType<
  (typeof client)["team-automation"]["triage"][":projectId"]["$put"]
>["json"];

async function updateTriageResponsibility(
  projectId: string,
  body: TriageResponsibility,
) {
  const response = await client["team-automation"].triage[":projectId"].$put({
    param: { projectId },
    json: body,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export default updateTriageResponsibility;
