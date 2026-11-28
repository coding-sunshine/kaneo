import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type DuplicateSuggestion = InferResponseType<
  (typeof client)["duplicate-suggestion"]["task"][":taskId"]["$get"],
  200
>["suggestions"][number];

async function getDuplicateSuggestions(taskId: string) {
  const response = await client["duplicate-suggestion"].task[":taskId"].$get({
    param: { taskId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getDuplicateSuggestions;
