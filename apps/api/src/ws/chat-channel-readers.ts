import { and, eq, inArray, sql } from "drizzle-orm";
import db from "../database";
import {
  chatChannelMemberTable,
  chatChannelTable,
  userTable,
  workspaceMemberAccessTable,
  workspaceUserTable,
} from "../database/schema";
import { directMessageOpenToGuest } from "../guest/direct-message-open-to-guest";
import { instanceAdminRoleSql } from "../utils/instance-admin-role";
import { workspaceIsActive } from "../workspace/archive/active-workspace-sql";

/**
 * Which of these users may read the channel right now: workspace members (or
 * instance admins) of an active workspace, and for a private channel only its
 * members. Guests read only the channels they are members of, public ones
 * too, and direct messages only with people they work with. Returns null when the lookup fails, so callers send nothing.
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
        isDirect: sql<boolean>`${chatChannelTable.directKey} is not null`,
        active: workspaceIsActive(chatChannelTable.workspaceId),
      })
      .from(chatChannelTable)
      .where(eq(chatChannelTable.id, channelId))
      .limit(1);
    if (!channel?.active || userIds.length === 0)
      return { workspaceId: channel?.workspaceId ?? null, readers: new Set() };

    const [members, admins, channelMembers, guests] = await Promise.all([
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
      db
        .select({ userId: chatChannelMemberTable.userId })
        .from(chatChannelMemberTable)
        .where(
          and(
            eq(chatChannelMemberTable.channelId, channelId),
            inArray(chatChannelMemberTable.userId, userIds),
          ),
        ),
      db
        .select({ userId: workspaceMemberAccessTable.userId })
        .from(workspaceMemberAccessTable)
        .where(
          and(
            eq(workspaceMemberAccessTable.workspaceId, channel.workspaceId),
            inArray(workspaceMemberAccessTable.userId, userIds),
            eq(workspaceMemberAccessTable.guest, true),
          ),
        ),
    ]);
    const inWorkspace = new Set([...members, ...admins].map((r) => r.userId));
    const inChannel = new Set(channelMembers.map((r) => r.userId));
    const guest = new Set(guests.map((r) => r.userId));
    const mustBeInChannel = (id: string) => channel.isPrivate || guest.has(id);
    const readers = new Set(
      [...inWorkspace].filter(
        (id) => !mustBeInChannel(id) || inChannel.has(id),
      ),
    );
    if (channel.isDirect) {
      for (const id of readers) {
        if (!guest.has(id)) continue;
        const [open] = await db
          .select({
            open: directMessageOpenToGuest(
              id,
              sql`${channelId}`,
              channel.workspaceId,
            ),
          })
          .from(sql`(select 1) as one`);
        if (!open?.open) readers.delete(id);
      }
    }
    return { workspaceId: channel.workspaceId, readers };
  } catch (error) {
    console.error("Failed to check chat channel readers:", error);
    return null;
  }
}
