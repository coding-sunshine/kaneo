import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  chatChannelMemberTable,
  workspaceUserTable,
} from "../../database/schema";
import { isWorkspaceGuest } from "../../guest/is-workspace-guest";
import { getChannel } from "./get-channel";
import { loadChannel } from "./load-channel";

export async function inviteMember(
  workspaceId: string,
  channelId: string,
  userId: string,
  inviteeId: string,
  // Whether the caller manages workspace members; only they add a guest.
  canAddGuests: boolean,
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
  if (!canAddGuests && (await isWorkspaceGuest(workspaceId, inviteeId)))
    throw new HTTPException(403, {
      message: "Only a workspace admin can add a guest to a channel",
    });
  await db
    .insert(chatChannelMemberTable)
    .values({ channelId, userId: inviteeId })
    .onConflictDoNothing();
  return getChannel(workspaceId, channelId, userId);
}
