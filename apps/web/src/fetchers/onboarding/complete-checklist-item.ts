import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type ManualChecklistItem = InferRequestType<
  (typeof client.onboarding.checklist.items)[":itemId"]["complete"]["$post"]
>["param"]["itemId"];

async function completeChecklistItem(itemId: ManualChecklistItem) {
  const response = await client.onboarding.checklist.items[
    ":itemId"
  ].complete.$post({ param: { itemId } });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default completeChecklistItem;
