import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

const workspace = client.chat.workspace[":workspaceId"];
const message = workspace.channels[":channelId"].messages[":messageId"];

type MessageParam = {
  workspaceId: string;
  channelId: string;
  messageId: string;
};

export async function remindMessage(param: MessageParam, remindAt: Date) {
  const response = await message.reminder.$post({
    param,
    json: { remindAt: remindAt.toISOString() },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function setMessageSaved(param: MessageParam, saved: boolean) {
  const response = await message.saved.$put({ param, json: { saved } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function getSavedMessages(workspaceId: string) {
  const response = await workspace["saved-messages"].$get({
    param: { workspaceId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
