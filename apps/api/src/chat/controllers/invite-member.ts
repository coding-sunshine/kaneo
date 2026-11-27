import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  chatChannelMemberTable,
  workspaceUserTable,
} from "../../database/schema";
import { getChannel } from "./get-channel";
import { loadChannel } from "./load-channel";

export async function inviteMember(
  workspaceId: string,
  channelId: string,
  userId: string,
  inviteeId: string,
) {
  await loadChannel(workspaceId, channelId, userId, "invite");
  // Only people already in the workspace can be added to its channels.
  const [invitee] = await db
    .select({ userId: workspaceUserTable.userId })
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        eq(workspaceUserTable.userId, inviteeId),
      ),
    );
  if (!invitee) throw new HTTPException(404, { message: "Member not found" });
  await db
    .insert(chatChannelMemberTable)
    .values({ channelId, userId: inviteeId })
    .onConflictDoNothing();
  return getChannel(workspaceId, channelId, userId);
}
