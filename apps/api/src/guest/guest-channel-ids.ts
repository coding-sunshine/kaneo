import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import db from "../database";
import { chatChannelMemberTable, chatChannelTable } from "../database/schema";

export function toChannelIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(value.filter((id): id is string => typeof id === "string")),
  ];
}

// The open channels of the workspace among `channelIds` that `actorId` can
// see: public ones, or private ones they belong to. Pass no actor to skip the
// visibility check (accepting an invitation that was checked when it was made).
export async function findGuestChannels(
  workspaceId: string,
  channelIds: string[],
  actorId?: string,
) {
  if (channelIds.length === 0) return [];
  const rows = await db
    .select({ id: chatChannelTable.id })
    .from(chatChannelTable)
    .leftJoin(
      chatChannelMemberTable,
      and(
        eq(chatChannelMemberTable.channelId, chatChannelTable.id),
        eq(chatChannelMemberTable.userId, actorId ?? ""),
      ),
    )
    .where(
      and(
        eq(chatChannelTable.workspaceId, workspaceId),
        inArray(chatChannelTable.id, channelIds),
        isNull(chatChannelTable.archivedAt),
        actorId
          ? or(
              eq(chatChannelTable.isPrivate, false),
              sql`${chatChannelMemberTable.userId} is not null`,
            )
          : undefined,
      ),
    );
  return rows.map((row) => row.id);
}
