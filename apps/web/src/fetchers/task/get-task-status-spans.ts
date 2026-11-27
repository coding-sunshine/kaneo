import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type TaskStatusSpans = InferResponseType<
  (typeof client)["task"][":id"]["status-spans"]["$get"],
  200
>;

async function getTaskStatusSpans(taskId: string) {
  const response = await client.task[":id"]["status-spans"].$get({
    param: { id: taskId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getTaskStatusSpans;
