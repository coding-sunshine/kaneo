import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type StandupDraft = InferResponseType<
  (typeof client)["standup"]["workspace"][":workspaceId"]["draft"]["$get"],
  200
>;

async function getStandupDraft(workspaceId: string, days: 1 | 7) {
  const response = await client.standup.workspace[":workspaceId"].draft.$get({
    param: { workspaceId },
    query: { days: String(days) },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getStandupDraft;
