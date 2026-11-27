import { HTTPException } from "hono/http-exception";
import { loadMessage } from "./load-message";

export type SourceMessage = { channelId: string; messageId: string };

// A ticket may point back at a chat message only when its creator can read
// that message, in the ticket's workspace. Any miss answers alike, so the
// reply never tells a hidden channel from a missing one.
export async function findSourceMessage(
  workspaceId: string,
  { channelId, messageId }: SourceMessage,
  userId: string,
) {
  try {
    return await loadMessage(workspaceId, channelId, messageId, userId, "read");
  } catch (error) {
    if (error instanceof HTTPException && error.status === 404)
      throw new HTTPException(400, { message: "Source message not found" });
    throw error;
  }
}
