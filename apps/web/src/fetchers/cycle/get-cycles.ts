import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type Cycle = InferResponseType<
  (typeof client)["cycle"]["project"][":projectId"]["$get"],
  200
>[number];

async function getCycles(projectId: string) {
  const response = await client.cycle.project[":projectId"].$get({
    param: { projectId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export default getCycles;
