import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

const upload =
  client.chat.workspace[":workspaceId"].channels[":channelId"].upload;

type ChannelParam = { workspaceId: string; channelId: string };

export async function createChatFileUpload(
  param: ChannelParam,
  json: { filename: string; size: number },
) {
  const response = await upload.$put({ param, json });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function finalizeChatFile(
  param: ChannelParam,
  json: {
    key: string;
    filename: string;
    size: number;
    body?: string;
    messageId?: string;
  },
) {
  const response = await upload.finalize.$post({ param, json });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
