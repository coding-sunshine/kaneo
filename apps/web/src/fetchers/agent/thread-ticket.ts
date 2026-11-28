import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

/** Asks the AI for a ticket card drafted from the message's whole thread. */
export async function proposeThreadTicket(
  workspaceId: string,
  channelId: string,
  messageId: string,
) {
  const response = await client.agent.workspace[":workspaceId"].channels[
    ":channelId"
  ].messages[":messageId"]["ticket-proposal"].$post({
    param: { workspaceId, channelId, messageId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
