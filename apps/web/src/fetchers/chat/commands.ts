import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function runChatCommand(
  workspaceId: string,
  channelId: string,
  text: string,
) {
  const response = await client.chat.workspace[":workspaceId"].channels[
    ":channelId"
  ].commands.$post({ param: { workspaceId, channelId }, json: { text } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
