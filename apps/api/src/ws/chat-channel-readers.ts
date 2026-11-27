import { and, eq, inArray } from "drizzle-orm";
import db from "../database";
import {
  chatChannelMemberTable,
  chatChannelTable,
  userTable,
  workspaceUserTable,
} from "../database/schema";
import { instanceAdminRoleSql } from "../utils/instance-admin-role";
import { workspaceIsActive } from "../workspace/archive/active-workspace-sql";

/**
 * Which of these users may read the channel right now: workspace members (or
 * instance admins) of an active workspace, and for a private channel only its
 * members. Returns null when the lookup fails, so callers send nothing.
 */
export async function findChannelReaders(
  channelId: string,
  userIds: string[],
): Promise<{ workspaceId: string | null; readers: Set<string> } | null> {
  try {
    const [channel] = await db
      .select({
        workspaceId: chatChannelTable.workspaceId,
        isPrivate: chatChannelTable.isPrivate,
        active: workspaceIsActive(chatChannelTable.workspaceId),
      })
      .from(chatChannelTable)
      .where(eq(chatChannelTable.id, channelId))
      .limit(1);
    if (!channel?.active || userIds.length === 0)
      return { workspaceId: channel?.workspaceId ?? null, readers: new Set() };

    const [members, admins, channelMembers] = await Promise.all([
      db
        .select({ userId: workspaceUserTable.userId })
        .from(workspaceUserTable)
        .where(
          and(
            eq(workspaceUserTable.workspaceId, channel.workspaceId),
            inArray(workspaceUserTable.userId, userIds),
          ),
        ),
      db
        .select({ userId: userTable.id })
        .from(userTable)
        .where(
          and(
            inArray(userTable.id, userIds),
            instanceAdminRoleSql(userTable.role),
          ),
        ),
      channel.isPrivate
        ? db
            .select({ userId: chatChannelMemberTable.userId })
            .from(chatChannelMemberTable)
            .where(
              and(
                eq(chatChannelMemberTable.channelId, channelId),
                inArray(chatChannelMemberTable.userId, userIds),
              ),
            )
        : null,
    ]);
    const inWorkspace = new Set([...members, ...admins].map((r) => r.userId));
    const inChannel = channelMembers
      ? new Set(channelMembers.map((r) => r.userId))
      : inWorkspace;
    return {
      workspaceId: channel.workspaceId,
      readers: new Set([...inWorkspace].filter((id) => inChannel.has(id))),
    };
  } catch (error) {
    console.error("Failed to check chat channel readers:", error);
    return null;
  }
}
