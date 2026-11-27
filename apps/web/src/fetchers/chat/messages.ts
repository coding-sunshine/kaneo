import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

const channel = client.chat.workspace[":workspaceId"].channels[":channelId"];
const messages = channel.messages;
const message = messages[":messageId"];

type ChannelParam = { workspaceId: string; channelId: string };
type MessageParam = ChannelParam & { messageId: string };

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

export async function getPins(param: ChannelParam) {
  const response = await channel.pins.$get({ param });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function editMessage(param: MessageParam, body: string) {
  const response = await message.$patch({ param, json: { body } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function deleteMessage(param: MessageParam) {
  const response = await message.$delete({ param });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function setMessagePinned(param: MessageParam, pinned: boolean) {
  const response = pinned
    ? await message.pin.$post({ param })
    : await message.pin.$delete({ param });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
