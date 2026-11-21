import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type TeamMembershipChanges = InferRequestType<
  (typeof client)["project"][":id"]["membership"]["$put"]
>["json"];

async function updateTeamMembership(
  projectId: string,
  changes: TeamMembershipChanges,
) {
  const response = await client.project[":id"].membership.$put({
    param: { id: projectId },
    json: changes,
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default updateTeamMembership;
