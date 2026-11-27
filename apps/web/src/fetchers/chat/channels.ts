import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

const channels = client.chat.workspace[":workspaceId"].channels;
const channel = channels[":channelId"];

type ChannelParam = { workspaceId: string; channelId: string };

export async function getChannels(workspaceId: string) {
  const response = await channels.$get({ param: { workspaceId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function createChannel(
  workspaceId: string,
  json: { name: string; topic?: string; isPrivate: boolean },
) {
  const response = await channels.$post({ param: { workspaceId }, json });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function getChannel(param: ChannelParam) {
  const response = await channel.$get({ param });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function updateChannel(
  param: ChannelParam,
  json: { name?: string; topic?: string | null; archived?: boolean },
) {
  const response = await channel.$patch({ param, json });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function joinChannel(param: ChannelParam) {
  const response = await channel.join.$post({ param });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function leaveChannel(param: ChannelParam) {
  const response = await channel.leave.$post({ param });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function addChannelMember(param: ChannelParam, userId: string) {
  const response = await channel.members.$post({ param, json: { userId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function markChannelRead(param: ChannelParam) {
  const response = await channel.read.$post({ param });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
