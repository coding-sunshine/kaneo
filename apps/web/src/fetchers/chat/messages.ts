import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

const messages =
  client.chat.workspace[":workspaceId"].channels[":channelId"].messages;

type ChannelParam = { workspaceId: string; channelId: string };

export async function getMessages(param: ChannelParam, around?: string) {
  const response = await messages.$get({
    param,
    query: around ? { around } : {},
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function postMessage(param: ChannelParam, body: string) {
  const response = await messages.$post({ param, json: { body } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
