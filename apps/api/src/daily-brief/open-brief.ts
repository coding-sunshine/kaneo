import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { dailyBriefTable } from "../database/schema";

/** A brief opens only for its owner; anyone else gets a missing brief. */
export async function openBrief(
  workspaceId: string,
  userId: string,
  briefId: string,
) {
  const [brief] = await db
    .select({
      id: dailyBriefTable.id,
      day: dailyBriefTable.day,
      content: dailyBriefTable.content,
      createdAt: dailyBriefTable.createdAt,
    })
    .from(dailyBriefTable)
    .where(
      and(
        eq(dailyBriefTable.id, briefId),
        eq(dailyBriefTable.workspaceId, workspaceId),
        eq(dailyBriefTable.userId, userId),
      ),
    );
  if (!brief) throw new HTTPException(404, { message: "Brief not found" });
  return {
    id: brief.id,
    day: brief.day,
    ...brief.content,
    createdAt: brief.createdAt.toISOString(),
  };
}
