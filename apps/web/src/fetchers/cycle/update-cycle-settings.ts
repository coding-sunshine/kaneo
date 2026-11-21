import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type CycleSettings = InferRequestType<
  (typeof client.cycle.settings)[":projectId"]["$put"]
>["json"];

async function updateCycleSettings(projectId: string, settings: CycleSettings) {
  const response = await client.cycle.settings[":projectId"].$put({
    param: { projectId },
    json: settings,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export default updateCycleSettings;
