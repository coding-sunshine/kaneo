import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

const directMessages = client.chat.workspace[":workspaceId"]["direct-messages"];

export async function getDirectMessages(workspaceId: string) {
  const response = await directMessages.$get({ param: { workspaceId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function openDirectMessage(
  workspaceId: string,
  userIds: string[],
) {
  const response = await directMessages.$post({
    param: { workspaceId },
    json: { userIds },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
