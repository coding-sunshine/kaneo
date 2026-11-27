import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import db from "../../database";
import { userTable, workspaceUserTable } from "../../database/schema";
import { escapeLikePattern } from "../like-pattern";
import type { SearchResult } from "../search-result";

// Members of one workspace by name or email: what its member list already
// shows to anyone who can read the workspace.
export async function searchPeople(params: {
  query: string;
  workspaceId: string;
  limit: number;
}): Promise<SearchResult[]> {
  const { query, workspaceId, limit } = params;
  const pattern = `%${escapeLikePattern(query.trim())}%`;
  const score = sql<number>`CASE
    WHEN LOWER(${userTable.name}) = LOWER(${query.trim()}) THEN 5
    WHEN ${userTable.name} ILIKE ${pattern} THEN 3
    ELSE 2
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
        or(ilike(userTable.name, pattern), ilike(userTable.email, pattern)),
      ),
    )
    .orderBy(desc(score), userTable.name)
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    type: "person",
    title: row.name,
    description: row.email,
    userId: row.id,
    workspaceId,
    createdAt: row.joinedAt,
    relevanceScore: row.relevanceScore,
  }));
}
