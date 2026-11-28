import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function sendTyping(
  workspaceId: string,
  channelId: string,
  typing: boolean,
) {
  const response = await client.chat.workspace[":workspaceId"].channels[
    ":channelId"
  ].typing.$post({ param: { workspaceId, channelId }, json: { typing } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
