import type { Context } from "hono";
import { hasWorkspacePermission } from "../utils/require-workspace-permission";
import type { ChatMessage } from "./openrouter";
import { type Citation, resolveCitations } from "./resolve-citations";
import { grounded, splitSources } from "./sources";

export type CitedMessage = ChatMessage & {
  citations?: Citation[];
  unsourced?: boolean;
};
type Reader = Parameters<typeof resolveCitations>[0];

/** Who reads the chat, with the permission their sources are checked against. */
export const readerOf = async (
  c: Context,
  workspaceId: string,
): Promise<Reader> => ({
  userId: c.get("userId"),
  workspaceId,
  mayReadTasks: await hasWorkspacePermission(
    c,
    { task: ["read"] },
    workspaceId,
  ),
});

/**
 * Gives each answer the sources it names, checked when the chat is read: a
 * source the reader can no longer open shows as restricted. A source counts
 * only when a tool returned its id in the same turn; an answer left with none
 * is `unsourced`. Stored messages keep their sources line for the model.
 */
export async function withCitations(
  reader: Reader,
  messages: ChatMessage[],
): Promise<CitedMessage[]> {
  let toolResults: string[] = [];
  const out: (CitedMessage | Promise<CitedMessage>)[] = [];
  for (const message of messages) {
    if (message.role === "user") toolResults = [];
    if (message.role === "tool") toolResults.push(message.content ?? "");
    if (
      message.role !== "assistant" ||
      !message.content ||
      message.tool_calls?.length
    ) {
      out.push(message);
      continue;
    }
    const { text, cited } = splitSources(message.content);
    const sources = grounded(cited, toolResults);
    out.push(
      resolveCitations(reader, sources).then((citations) => ({
        ...message,
        content: text,
        citations,
        unsourced: sources.length === 0,
      })),
    );
  }
  return Promise.all(out);
}
