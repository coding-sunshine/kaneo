import { and, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { startOfUtcMonth } from "../agent/budget";
import db from "../database";
import { aiSkillUsageTable } from "../database/schema";

/** Tokens a run sets aside for its answer until the real count is known. */
const ANSWER_RESERVE = 1000;

type Skill = {
  workspaceId: string;
  userId: string;
  name: string;
  monthlyTokenCap: number | null;
};

const monthKey = () => startOfUtcMonth().toISOString().slice(0, 7);

/**
 * Reserves a run's estimated tokens against the skill's monthly cap in one
 * statement, so runs that start together cannot all pass a check that each
 * read before the others wrote. Throws 429 once the month's usage reached
 * the cap. Returns the settle step for after the run.
 */
export async function reserveSkillTokens(skill: Skill, promptTokens: number) {
  const reserved = promptTokens + ANSWER_RESERVE;
  const month = monthKey();
  const key = and(
    eq(aiSkillUsageTable.workspaceId, skill.workspaceId),
    eq(aiSkillUsageTable.userId, skill.userId),
    eq(aiSkillUsageTable.skillName, skill.name),
    eq(aiSkillUsageTable.month, month),
  );
  const [row] = await db
    .insert(aiSkillUsageTable)
    .values({
      workspaceId: skill.workspaceId,
      userId: skill.userId,
      skillName: skill.name,
      month,
      tokens: reserved,
    })
    .onConflictDoUpdate({
      target: [
        aiSkillUsageTable.workspaceId,
        aiSkillUsageTable.userId,
        aiSkillUsageTable.skillName,
        aiSkillUsageTable.month,
      ],
      set: { tokens: sql`${aiSkillUsageTable.tokens} + excluded.tokens` },
      ...(skill.monthlyTokenCap === null
        ? {}
        : {
            setWhere: sql`${aiSkillUsageTable.tokens} < ${skill.monthlyTokenCap}`,
          }),
    })
    .returning({ tokens: aiSkillUsageTable.tokens });
  if (!row)
    throw new HTTPException(429, {
      message: `The skill ${skill.name} used its monthly credit cap of ${skill.monthlyTokenCap} tokens. It runs again on the 1st (UTC), or raise its cap.`,
    });
  /** Replaces the reservation with what the run used; 0 when it failed. */
  return async (used: number) => {
    await db
      .update(aiSkillUsageTable)
      .set({
        tokens: sql`greatest(${aiSkillUsageTable.tokens} + ${used - reserved}, 0)`,
      })
      .where(key);
  };
}
