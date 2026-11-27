import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  chatChannelMemberTable,
  chatChannelTable,
  workspaceUserTable,
} from "../../database/schema";
import { assertGuestsWorkWithMembers } from "../../guest/assert-guests-work-with-members";
import { getChannel } from "./get-channel";

// Opens the one conversation for this set of people, creating it on first
// use. The unique direct key makes two simultaneous opens land on one row.
export async function openDirectMessage(
  workspaceId: string,
  userId: string,
  userIds: string[],
) {
  const others = [...new Set(userIds)].filter((id) => id !== userId);
  if (others.length === 0)
    throw new HTTPException(400, {
      message: "Pick at least one other member",
    });
  const found = await db
    .select({ userId: workspaceUserTable.userId })
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        inArray(workspaceUserTable.userId, others),
      ),
    );
  if (found.length !== others.length)
    throw new HTTPException(404, { message: "Member not found" });

  const memberIds = [userId, ...others].sort();
  await assertGuestsWorkWithMembers(workspaceId, memberIds);
  const directKey = memberIds.join(",");
  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(chatChannelTable)
      .values({
        workspaceId,
        name: "",
        isPrivate: true,
        directKey,
        createdBy: userId,
      })
      .onConflictDoNothing()
      .returning({ id: chatChannelTable.id });
    if (created)
      await tx
        .insert(chatChannelMemberTable)
        .values(memberIds.map((id) => ({ channelId: created.id, userId: id })));
  });
  const [channel] = await db
    .select({ id: chatChannelTable.id })
    .from(chatChannelTable)
    .where(
      and(
        eq(chatChannelTable.workspaceId, workspaceId),
        eq(chatChannelTable.directKey, directKey),
      ),
    );
  if (!channel) throw new Error("Direct message insert returned no row");
  return getChannel(workspaceId, channel.id, userId);
}
