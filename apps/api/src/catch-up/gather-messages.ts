import {
  aliasedTable,
  and,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  ne,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import { aiAllowedChannel } from "../assist/ai-allowed-channel";
import { readableChannel } from "../chat/readable-channel";
import db from "../database";
import {
  chatChannelMemberTable,
  chatChannelTable,
  chatMessageTable,
  chatThreadReplyTable,
  userTable,
} from "../database/schema";
import { isWorkspaceGuest } from "../guest/is-workspace-guest";

const MAX_UNREAD = 150;
const MAX_REPLIES = 80;

export type GatheredMessage = {
  id: string;
  body: string;
  author: string | null;
  channelId: string;
  channelName: string;
  /** The thread a reply belongs to; a citation links there. */
  threadId: string | null;
  createdAt: Date;
};

/**
 * What the reader missed in chat since `since`: unread messages from others
 * in channels they joined, and replies from others in threads they started
 * or answered. Only channels they can read now that AI may read.
 */
export async function gatherMissedMessages(
  workspaceId: string,
  userId: string,
  since: Date,
  includeDirectMessages: boolean,
): Promise<GatheredMessage[]> {
  const guest = await isWorkspaceGuest(workspaceId, userId);
  const allowed = and(
    eq(chatChannelTable.workspaceId, workspaceId),
    readableChannel(userId, workspaceId, guest),
    aiAllowedChannel(includeDirectMessages),
  );
  const fromOthers = or(
    isNull(chatMessageTable.userId),
    ne(chatMessageTable.userId, userId),
  );
  const columns = {
    id: chatMessageTable.id,
    body: chatMessageTable.body,
    author: userTable.name,
    channelId: chatChannelTable.id,
    channelName: chatChannelTable.name,
    createdAt: chatMessageTable.createdAt,
  };

  const unread = await db
    .select(columns)
    .from(chatMessageTable)
    .innerJoin(
      chatChannelTable,
      eq(chatChannelTable.id, chatMessageTable.channelId),
    )
    .innerJoin(
      chatChannelMemberTable,
      and(
        eq(chatChannelMemberTable.channelId, chatChannelTable.id),
        eq(chatChannelMemberTable.userId, userId),
      ),
    )
    .leftJoin(userTable, eq(userTable.id, chatMessageTable.userId))
    .where(
      and(
        allowed,
        fromOthers,
        gt(chatMessageTable.createdAt, since),
        gt(chatMessageTable.createdAt, chatChannelMemberTable.lastReadAt),
        notExists(
          db
            .select({ one: sql`1` })
            .from(chatThreadReplyTable)
            .where(eq(chatThreadReplyTable.messageId, chatMessageTable.id)),
        ),
      ),
    )
    .orderBy(desc(chatMessageTable.createdAt))
    .limit(MAX_UNREAD);

  // Threads I started or answered.
  const parent = aliasedTable(chatMessageTable, "catch_up_parent");
  const mine = aliasedTable(chatThreadReplyTable, "catch_up_mine");
  const mineMessage = aliasedTable(chatMessageTable, "catch_up_mine_message");
  const myThreads = db
    .select({ id: mine.parentId })
    .from(mine)
    .innerJoin(mineMessage, eq(mineMessage.id, mine.messageId))
    .where(eq(mineMessage.userId, userId));
  const replies = await db
    .select({ ...columns, threadId: chatThreadReplyTable.parentId })
    .from(chatThreadReplyTable)
    .innerJoin(
      chatMessageTable,
      eq(chatMessageTable.id, chatThreadReplyTable.messageId),
    )
    .innerJoin(parent, eq(parent.id, chatThreadReplyTable.parentId))
    .innerJoin(
      chatChannelTable,
      eq(chatChannelTable.id, chatMessageTable.channelId),
    )
    .leftJoin(userTable, eq(userTable.id, chatMessageTable.userId))
    .where(
      and(
        allowed,
        fromOthers,
        gt(chatMessageTable.createdAt, since),
        or(
          eq(parent.userId, userId),
          inArray(chatThreadReplyTable.parentId, myThreads),
        ),
      ),
    )
    .orderBy(desc(chatMessageTable.createdAt))
    .limit(MAX_REPLIES);

  return [...unread.map((row) => ({ ...row, threadId: null })), ...replies];
}
