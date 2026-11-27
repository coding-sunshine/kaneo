import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type DesignReview = InferResponseType<
  (typeof client)["design-review"]["task"][":taskId"]["$get"],
  200
>[number];

export default async function getDesignReviews(taskId: string) {
  const response = await client["design-review"].task[":taskId"].$get({
    param: { taskId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
