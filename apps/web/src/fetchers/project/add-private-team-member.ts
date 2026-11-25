import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export type PrivateTeamMemberRequest = { projectId: string; userId: string };

async function addPrivateTeamMember({
  projectId,
  userId,
}: PrivateTeamMemberRequest) {
  const response = await client.project[":id"]["private-members"][
    ":userId"
  ].$put({ param: { id: projectId, userId } });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default addPrivateTeamMember;
