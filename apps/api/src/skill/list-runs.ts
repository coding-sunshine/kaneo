import { and, desc, eq } from "drizzle-orm";
import db from "../database";
import { aiSkillRunTable, aiSkillTable } from "../database/schema";

const MAX_RUNS = 50;

/** The reader's own skill runs, newest first. */
export async function listSkillRuns(owner: {
  workspaceId: string;
  userId: string;
}) {
  const rows = await db
    .select({
      id: aiSkillRunTable.id,
      skillId: aiSkillRunTable.skillId,
      skillName: aiSkillTable.name,
      channelId: aiSkillRunTable.channelId,
      promptTokens: aiSkillRunTable.promptTokens,
      completionTokens: aiSkillRunTable.completionTokens,
      createdAt: aiSkillRunTable.createdAt,
    })
    .from(aiSkillRunTable)
    .innerJoin(aiSkillTable, eq(aiSkillTable.id, aiSkillRunTable.skillId))
    .where(
      and(
        eq(aiSkillRunTable.userId, owner.userId),
        eq(aiSkillTable.workspaceId, owner.workspaceId),
      ),
    )
    .orderBy(desc(aiSkillRunTable.createdAt))
    .limit(MAX_RUNS);
  return {
    runs: rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
