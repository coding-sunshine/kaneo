import { and, desc, eq, gte, sql } from "drizzle-orm";
import db from "../database";
import { aiUsageTable } from "../database/schema";
import { getBudget, monthTokens, startOfUtcDay, usedTokens } from "./budget";

const REPORT_DAYS = 30;

/** A workspace's AI tokens of the last 30 UTC days, by feature and by day. */
export async function usageReport(workspaceId: string) {
  const since = startOfUtcDay();
  since.setUTCDate(since.getUTCDate() - (REPORT_DAYS - 1));
  const inWorkspace = and(
    eq(aiUsageTable.workspaceId, workspaceId),
    gte(aiUsageTable.createdAt, since),
  );
  // created_at holds UTC wall time, so its date is the UTC day.
  const day = sql<string>`to_char(${aiUsageTable.createdAt}, 'YYYY-MM-DD')`;
  const [budget, month, byFeature, byDay] = await Promise.all([
    getBudget(workspaceId),
    monthTokens(workspaceId),
    db
      .select({
        feature: aiUsageTable.purpose,
        tokens: usedTokens,
        cost: sql<number | null>`sum(${aiUsageTable.cost})::float8`,
      })
      .from(aiUsageTable)
      .where(inWorkspace)
      .groupBy(aiUsageTable.purpose)
      .orderBy(desc(usedTokens)),
    db
      .select({ day, tokens: usedTokens })
      .from(aiUsageTable)
      .where(inWorkspace)
      .groupBy(day)
      .orderBy(desc(day)),
  ]);
  return { budget, monthTokens: month, days: REPORT_DAYS, byFeature, byDay };
}
