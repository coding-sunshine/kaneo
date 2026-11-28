import { eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import db from "../../database";
import {
  chatMessageTable,
  chatThreadReplyTable,
  userTable,
} from "../../database/schema";

// The message's own thread link; a separate name from the count's subquery.
export const threadLink = alias(chatThreadReplyTable, "thread_link");
// Thread replies sit under their parent, not in the channel timeline.
export const inTimeline = isNull(threadLink.messageId);

export const selectMessages = () =>
  db
    .select({
      id: chatMessageTable.id,
      channelId: chatMessageTable.channelId,
      userId: chatMessageTable.userId,
      authorName: userTable.name,
      authorImage: userTable.image,
      body: chatMessageTable.body,
      editedAt: chatMessageTable.editedAt,
      pinnedAt: chatMessageTable.pinnedAt,
      linkPreview: chatMessageTable.linkPreview,
      parentId: threadLink.parentId,
      replyCount: sql<number>`(select count(*)::int from ${chatThreadReplyTable} where ${chatThreadReplyTable.parentId} = ${chatMessageTable.id})`,
      createdAt: chatMessageTable.createdAt,
    })
    .from(chatMessageTable)
    .leftJoin(userTable, eq(userTable.id, chatMessageTable.userId))
    .leftJoin(threadLink, eq(threadLink.messageId, chatMessageTable.id));
