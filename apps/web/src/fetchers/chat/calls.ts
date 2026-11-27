import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

type ChannelParam = { workspaceId: string; channelId: string };

// Resolved per request, so the user socket can import this without the client.
const call = () =>
  client.chat.workspace[":workspaceId"].channels[":channelId"].call;

export async function startCall(param: ChannelParam) {
  const response = await call().$post({ param });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function joinCall(param: ChannelParam) {
  const response = await call().join.$post({ param });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
