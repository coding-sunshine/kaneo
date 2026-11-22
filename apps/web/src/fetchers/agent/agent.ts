import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function getChats(workspaceId: string) {
  const response = await client.agent.workspace[":workspaceId"].chats.$get({
    param: { workspaceId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function getChat(workspaceId: string, chatId: string) {
  const response = await client.agent.workspace[":workspaceId"].chats[
    ":chatId"
  ].$get({ param: { workspaceId, chatId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function deleteChat(workspaceId: string, chatId: string) {
  const response = await client.agent.workspace[":workspaceId"].chats[
    ":chatId"
  ].$delete({ param: { workspaceId, chatId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function sendMessage(
  workspaceId: string,
  input: { chatId?: string; message: string },
) {
  const response = await client.agent.workspace[":workspaceId"].messages.$post({
    param: { workspaceId },
    json: input,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
