import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type SlaSettings = InferRequestType<
  (typeof client)["team-automation"]["sla"][":projectId"]["$put"]
>["json"];

async function updateSlaSettings(projectId: string, settings: SlaSettings) {
  const response = await client["team-automation"].sla[":projectId"].$put({
    param: { projectId },
    json: settings,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export default updateSlaSettings;
