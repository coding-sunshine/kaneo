import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

/** What the AI drafts from a chat thread: a ticket or a decision. */
export type ThreadProposalKind = "ticket" | "decision";

/** Asks the AI for a card drafted from the message's whole thread. */
export async function proposeFromThread(
  kind: ThreadProposalKind,
  workspaceId: string,
  channelId: string,
  messageId: string,
) {
  const route =
    client.agent.workspace[":workspaceId"].channels[":channelId"].messages[
      ":messageId"
    ];
  const param = { workspaceId, channelId, messageId };
  const response =
    kind === "ticket"
      ? await route["ticket-proposal"].$post({ param })
      : await route["decision-proposal"].$post({ param });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
