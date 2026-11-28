import { count, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  chatChannelMemberTable,
  chatChannelTable,
} from "../../database/schema";
import { findBroadcastMention } from "./find-broadcast-mention";

// Up to this many members, anyone who may post may call on all of them.
export const OPEN_BROADCAST_MEMBERS = 5;

/**
 * In a channel of more than 5 members only its owner may post @channel or
 * @here, so one member cannot page a whole team. Direct messages already
 * reach everyone in them.
 */
export async function assertCanBroadcast(
  channelId: string,
  userId: string,
  body: string | undefined,
) {
  if (!body || !findBroadcastMention(body)) return;
  const [channel] = await db
    .select({
      createdBy: chatChannelTable.createdBy,
      isDirect: sql<boolean>`${chatChannelTable.directKey} is not null`,
    })
    .from(chatChannelTable)
    .where(eq(chatChannelTable.id, channelId));
  if (!channel || channel.isDirect || channel.createdBy === userId) return;
  const [members] = await db
    .select({ count: count() })
    .from(chatChannelMemberTable)
    .where(eq(chatChannelMemberTable.channelId, channelId));
  if ((members?.count ?? 0) <= OPEN_BROADCAST_MEMBERS) return;
  throw new HTTPException(403, {
    message: `Only the channel owner can use @channel or @here in a channel with more than ${OPEN_BROADCAST_MEMBERS} members`,
  });
}
