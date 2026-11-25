import { gte, sql } from "drizzle-orm";
import db from "../database";
import { aiUsageTable } from "../database/schema";

type Usage = {
  purpose: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  cost: number | null;
};

/** Tokens of every extraction call since the start of the UTC day. */
export async function tokensUsedToday() {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const [row] = await db
    .select({
      tokens: sql<number>`coalesce(sum(${aiUsageTable.promptTokens} + ${aiUsageTable.completionTokens}), 0)::int`,
    })
    .from(aiUsageTable)
    .where(gte(aiUsageTable.createdAt, start));
  return row?.tokens ?? 0;
}

export async function recordUsage(usage: Usage) {
  await db.insert(aiUsageTable).values(usage);
}
