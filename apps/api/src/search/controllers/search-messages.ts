import { and, desc, eq, ilike, sql } from "drizzle-orm";
import db from "../../database";
import {
  chatChannelTable,
  chatMessageTable,
  userTable,
} from "../../database/schema";
import { readableChannel } from "../../chat/readable-channel";
import { isWorkspaceGuest } from "../../guest/is-workspace-guest";
import { bodyVector, type FtsQuery, ftsMatch } from "../fts";
import { escapeLikePattern } from "../like-pattern";
import type { SearchResult } from "../search-result";

// Chat messages from channels and direct messages the searcher can read in
// one workspace. Archived channels stay readable, so their messages count.
export async function searchMessages(params: {
  query: string;
  fts: FtsQuery | null;
  userId: string;
  workspaceId: string;
  limit: number;
}): Promise<SearchResult[]> {
  const { query, fts, userId, workspaceId, limit } = params;
  const bodyFts = fts ? ftsMatch(bodyVector(chatMessageTable.body), fts) : null;
  const score = bodyFts ? bodyFts.score(2) : sql<number>`2`;
  const guest = await isWorkspaceGuest(workspaceId, userId);

  const rows = await db
    .select({
      id: chatMessageTable.id,
      body: chatMessageTable.body,
      channelId: chatChannelTable.id,
      channelName: chatChannelTable.name,
      isDirect: sql<boolean>`${chatChannelTable.directKey} is not null`,
      userId: chatMessageTable.userId,
      userName: userTable.name,
      createdAt: chatMessageTable.createdAt,
      relevanceScore: score.as("relevanceScore"),
    })
    .from(chatMessageTable)
    .innerJoin(
      chatChannelTable,
      eq(chatChannelTable.id, chatMessageTable.channelId),
    )
    .leftJoin(userTable, eq(userTable.id, chatMessageTable.userId))
    .where(
      and(
        eq(chatChannelTable.workspaceId, workspaceId),
        readableChannel(userId, workspaceId, guest),
        bodyFts?.match ??
          ilike(chatMessageTable.body, `%${escapeLikePattern(query)}%`),
      ),
    )
    .orderBy(desc(score), desc(chatMessageTable.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    type: "message",
    // A direct message has no name; the client titles it after its people.
    title: row.isDirect ? "" : row.channelName,
    content: row.body,
    channelId: row.channelId,
    isDirect: row.isDirect,
    workspaceId,
    userId: row.userId ?? undefined,
    userName: row.userName ?? undefined,
    createdAt: row.createdAt,
    relevanceScore: row.relevanceScore,
  }));
}
