import { client } from "@kaneo/libs";
import type { TranscriptMessage } from "@/components/agent/agent-transcript";
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

export type AgentStreamEvent =
  | { type: "chat"; chatId: string; title: string }
  | { type: "delta"; text: string }
  | { type: "message"; message: TranscriptMessage }
  | { type: "done" }
  | { type: "error"; message: string };

/** Sends a message and reads the server-sent events as they arrive. */
export async function streamMessage(
  workspaceId: string,
  input: { chatId?: string; message: string },
  onEvent: (event: AgentStreamEvent) => void,
) {
  const response = await client.agent.workspace[
    ":workspaceId"
  ].messages.stream.$post({
    param: { workspaceId },
    json: input,
  });
  if (!response.ok || !response.body)
    throw await HttpError.fromResponse(response);
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data:"))
        onEvent(JSON.parse(line.slice(5)) as AgentStreamEvent);
    }
  }
}
