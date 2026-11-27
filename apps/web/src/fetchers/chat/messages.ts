import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

const messages =
  client.chat.workspace[":workspaceId"].channels[":channelId"].messages;

type ChannelParam = { workspaceId: string; channelId: string };

export async function getMessages(param: ChannelParam) {
  const response = await messages.$get({ param, query: {} });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function postMessage(param: ChannelParam, body: string) {
  const response = await messages.$post({ param, json: { body } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function removeLinkPreview(
  param: ChannelParam & { messageId: string },
) {
  const response = await messages[":messageId"].preview.$delete({ param });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
