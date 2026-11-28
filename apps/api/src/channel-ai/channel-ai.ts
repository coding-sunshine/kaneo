import { eq } from "drizzle-orm";
import { loadChannel } from "../chat/controllers/load-channel";
import db from "../database";
import { chatChannelAiExclusionTable } from "../database/schema";

/** Whether the channel is marked "no AI"; anyone who can read it may ask. */
export async function getChannelAi(
  workspaceId: string,
  channelId: string,
  userId: string,
) {
  await loadChannel(workspaceId, channelId, userId, "read");
  const [row] = await db
    .select({ channelId: chatChannelAiExclusionTable.channelId })
    .from(chatChannelAiExclusionTable)
    .where(eq(chatChannelAiExclusionTable.channelId, channelId));
  return { excluded: Boolean(row) };
}

/** Marks or unmarks the channel "no AI"; its members manage it. */
export async function setChannelAi(
  workspaceId: string,
  channelId: string,
  userId: string,
  excluded: boolean,
) {
  await loadChannel(workspaceId, channelId, userId, "manage");
  if (excluded)
    await db
      .insert(chatChannelAiExclusionTable)
      .values({ channelId, setBy: userId })
      .onConflictDoNothing();
  else
    await db
      .delete(chatChannelAiExclusionTable)
      .where(eq(chatChannelAiExclusionTable.channelId, channelId));
  return { excluded };
}
