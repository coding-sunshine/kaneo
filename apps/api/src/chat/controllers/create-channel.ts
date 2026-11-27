import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import db from "../../database";
import {
  chatChannelMemberTable,
  chatChannelTable,
} from "../../database/schema";
import { isWorkspaceGuest } from "../../guest/is-workspace-guest";
import type { createChannelBody } from "../schema";
import { loadChannel } from "./load-channel";

export async function createChannel(
  workspaceId: string,
  userId: string,
  body: z.infer<typeof createChannelBody>,
) {
  if (await isWorkspaceGuest(workspaceId, userId))
    throw new HTTPException(403, { message: "Guests cannot create channels" });
  const channelId = await db.transaction(async (tx) => {
    const [channel] = await tx
      .insert(chatChannelTable)
      .values({ ...body, workspaceId, createdBy: userId })
      .returning({ id: chatChannelTable.id });
    if (!channel) throw new Error("Channel insert returned no row");
    await tx
      .insert(chatChannelMemberTable)
      .values({ channelId: channel.id, userId });
    return channel.id;
  });
  return loadChannel(workspaceId, channelId, userId, "read");
}
