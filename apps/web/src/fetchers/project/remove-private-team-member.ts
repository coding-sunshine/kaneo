import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { PrivateTeamMemberRequest } from "./add-private-team-member";

async function removePrivateTeamMember({
  projectId,
  userId,
}: PrivateTeamMemberRequest) {
  const response = await client.project[":id"]["private-members"][
    ":userId"
  ].$delete({ param: { id: projectId, userId } });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default removePrivateTeamMember;
