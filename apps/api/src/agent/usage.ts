import { and, gte, isNull, sql } from "drizzle-orm";
import db from "../database";
import { aiUsageTable } from "../database/schema";

type Usage = {
  purpose: string;
  /** Set for calls made for a person; extraction jobs leave both unset. */
  workspaceId?: string;
  userId?: string;
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
    .where(
      and(isNull(aiUsageTable.workspaceId), gte(aiUsageTable.createdAt, start)),
    );
  return row?.tokens ?? 0;
}

/**
 * Dollars spent on every extraction call so far.
 * ponytail: a call the provider reports no cost for is not counted.
 */
export async function spentUsd() {
  const [row] = await db
    .select({
      spent: sql<number>`coalesce(sum(${aiUsageTable.cost}), 0)::float8`,
    })
    .from(aiUsageTable)
    .where(isNull(aiUsageTable.workspaceId));
  return row?.spent ?? 0;
}

export async function recordUsage(usage: Usage) {
  await db.insert(aiUsageTable).values(usage);
}
