import { and, eq, gte, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { startOfUtcMonth } from "../agent/budget";
import db from "../database";
import { aiSkillRunTable } from "../database/schema";

/** Throws 429 once the skill's runs this month have used its token cap. */
export async function assertSkillWithinCap(skill: {
  id: string;
  name: string;
  monthlyTokenCap: number | null;
}) {
  if (skill.monthlyTokenCap === null) return;
  const [row] = await db
    .select({
      used: sql<number>`coalesce(sum(${aiSkillRunTable.promptTokens} + ${aiSkillRunTable.completionTokens}), 0)::bigint`.mapWith(
        Number,
      ),
    })
    .from(aiSkillRunTable)
    .where(
      and(
        eq(aiSkillRunTable.skillId, skill.id),
        gte(aiSkillRunTable.createdAt, startOfUtcMonth()),
      ),
    );
  if ((row?.used ?? 0) >= skill.monthlyTokenCap)
    throw new HTTPException(429, {
      message: `The skill ${skill.name} used its monthly credit cap of ${skill.monthlyTokenCap} tokens. It runs again on the 1st (UTC), or raise its cap.`,
    });
}
