import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type DoneTask = InferResponseType<
  (typeof client)["task"]["done"]["$get"],
  200
>["tasks"][number];

async function getDoneTasks(workspaceId: string, since: string) {
  const response = await client.task.done.$get({
    query: { workspaceId, since },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getDoneTasks;
