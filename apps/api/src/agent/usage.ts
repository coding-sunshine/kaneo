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

const DEFAULT_MONTHLY_USD_CAP = 20;

/** Midnight UTC on the first day of the calendar month `now` falls in. */
export function monthStart(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function monthlyUsdCap() {
  const cap = Number(process.env.AI_MONTHLY_USD_CAP || Number.NaN);
  return Number.isFinite(cap) && cap >= 0 ? cap : DEFAULT_MONTHLY_USD_CAP;
}

/**
 * Whether an AI call may still spend this calendar month (UTC): every call
 * that records its usage counts, and the cap is `AI_MONTHLY_USD_CAP` dollars,
 * times `share`. A new month starts from nothing.
 * ponytail: a call the provider reports no cost for is not counted.
 */
export async function withinMonthlyCap(share = 1, now = new Date()) {
  const [row] = await db
    .select({
      spent: sql<number>`coalesce(sum(${aiUsageTable.cost}), 0)::float8`,
    })
    .from(aiUsageTable)
    .where(gte(aiUsageTable.createdAt, monthStart(now)));
  return (row?.spent ?? 0) < monthlyUsdCap() * share;
}

export async function recordUsage(usage: Usage) {
  await db.insert(aiUsageTable).values(usage);
}
