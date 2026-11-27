import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { chatChannelTable } from "../../database/schema";

// Socket URLs carry only the channel id; access is checked against this
// workspace before anything about the channel is revealed.
export async function findChannelWorkspace(channelId: string) {
  const [channel] = await db
    .select({ workspaceId: chatChannelTable.workspaceId })
    .from(chatChannelTable)
    .where(eq(chatChannelTable.id, channelId))
    .limit(1);
  if (!channel) throw new HTTPException(404, { message: "Channel not found" });
  return channel.workspaceId;
}
