import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

const api =
  client["channel-ai"].workspace[":workspaceId"].channels[":channelId"];

export async function getChannelAi(workspaceId: string, channelId: string) {
  const response = await api.$get({ param: { workspaceId, channelId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function setChannelAi(
  workspaceId: string,
  channelId: string,
  excluded: boolean,
) {
  const response = await api.$put({
    param: { workspaceId, channelId },
    json: { excluded },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
