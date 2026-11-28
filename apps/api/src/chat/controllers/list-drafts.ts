import { and, desc, eq } from "drizzle-orm";
import db from "../../database";
import { chatChannelTable, chatDraftTable } from "../../database/schema";
import { isWorkspaceGuest } from "../../guest/is-workspace-guest";
import { readableChannel } from "../readable-channel";

/**
 * The caller's own unsent drafts in this workspace, newest first. A draft in
 * a channel the caller can no longer read is not listed.
 */
export async function listDrafts(workspaceId: string, userId: string) {
  const guest = await isWorkspaceGuest(workspaceId, userId);
  return db
    .select({
      channelId: chatDraftTable.channelId,
      body: chatDraftTable.body,
      updatedAt: chatDraftTable.updatedAt,
    })
    .from(chatDraftTable)
    .innerJoin(
      chatChannelTable,
      eq(chatChannelTable.id, chatDraftTable.channelId),
    )
    .where(
      and(
        eq(chatDraftTable.userId, userId),
        eq(chatChannelTable.workspaceId, workspaceId),
        readableChannel(userId, workspaceId, guest),
      ),
    )
    .orderBy(desc(chatDraftTable.updatedAt));
}
