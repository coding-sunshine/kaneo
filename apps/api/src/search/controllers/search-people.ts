import { and, desc, eq, ilike, sql } from "drizzle-orm";
import db from "../../database";
import { userTable, workspaceUserTable } from "../../database/schema";
import { isWorkspaceGuest } from "../../guest/is-workspace-guest";
import { sharesProjectCondition } from "../../guest/shares-project-condition";
import { escapeLikePattern } from "../like-pattern";
import type { SearchResult } from "../search-result";

// Members of one workspace by name. Email addresses are never matched, so a
// search cannot confirm who holds one. A guest finds only the people of their
// own projects, without their email addresses, as on the member list.
export async function searchPeople(params: {
  query: string;
  userId: string;
  workspaceId: string;
  limit: number;
}): Promise<SearchResult[]> {
  const { query, userId, workspaceId, limit } = params;
  const guest = await isWorkspaceGuest(workspaceId, userId);
  const pattern = `%${escapeLikePattern(query.trim())}%`;
  const score = sql<number>`CASE
    WHEN LOWER(${userTable.name}) = LOWER(${query.trim()}) THEN 5
    ELSE 3
  END`;

  const rows = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      joinedAt: workspaceUserTable.joinedAt,
      relevanceScore: score.as("relevanceScore"),
    })
    .from(workspaceUserTable)
    .innerJoin(userTable, eq(userTable.id, workspaceUserTable.userId))
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        ilike(userTable.name, pattern),
        guest
          ? sharesProjectCondition(
              userId,
              workspaceUserTable.userId,
              workspaceId,
            )
          : undefined,
      ),
    )
    .orderBy(desc(score), userTable.name)
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    type: "person",
    title: row.name,
    description: guest && row.id !== userId ? undefined : row.email,
    userId: row.id,
    workspaceId,
    createdAt: row.joinedAt,
    relevanceScore: row.relevanceScore,
  }));
}
