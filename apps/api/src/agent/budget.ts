import { and, eq, gte, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { aiBudgetTable, aiUsageTable } from "../database/schema";

export type AiBudget = {
  userDailyTokens: number | null;
  workspaceMonthlyTokens: number | null;
};

export const startOfUtcDay = (now = new Date()) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

export const startOfUtcMonth = (now = new Date()) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

// bigint, since a workspace's sum can pass 2^31; the driver returns it as text.
export const usedTokens =
  sql<number>`coalesce(sum(${aiUsageTable.promptTokens}::bigint + ${aiUsageTable.completionTokens}), 0)::bigint`.mapWith(
    Number,
  );

export async function getBudget(workspaceId: string): Promise<AiBudget> {
  const [row] = await db
    .select({
      userDailyTokens: aiBudgetTable.userDailyTokens,
      workspaceMonthlyTokens: aiBudgetTable.workspaceMonthlyTokens,
    })
    .from(aiBudgetTable)
    .where(eq(aiBudgetTable.workspaceId, workspaceId));
  return row ?? { userDailyTokens: null, workspaceMonthlyTokens: null };
}

export async function setBudget(workspaceId: string, budget: AiBudget) {
  await db
    .insert(aiBudgetTable)
    .values({ workspaceId, ...budget })
    .onConflictDoUpdate({
      target: aiBudgetTable.workspaceId,
      set: { ...budget, updatedAt: new Date() },
    });
  return getBudget(workspaceId);
}

async function tokensSince(since: Date, workspaceId: string, userId?: string) {
  const [row] = await db
    .select({ tokens: usedTokens })
    .from(aiUsageTable)
    .where(
      and(
        eq(aiUsageTable.workspaceId, workspaceId),
        userId ? eq(aiUsageTable.userId, userId) : undefined,
        gte(aiUsageTable.createdAt, since),
      ),
    );
  return row?.tokens ?? 0;
}

/**
 * Throws 429 when the person's daily budget or the workspace's monthly budget
 * is used up. Runs before every model call made for a person, so a spent
 * budget never reaches the model.
 */
export async function assertWithinBudget(workspaceId: string, userId: string) {
  const budget = await getBudget(workspaceId);
  if (
    budget.userDailyTokens !== null &&
    (await tokensSince(startOfUtcDay(), workspaceId, userId)) >=
      budget.userDailyTokens
  )
    throw new HTTPException(429, {
      message:
        "AI is paused for you: daily AI limit reached. It resets at 00:00 UTC.",
    });
  if (
    budget.workspaceMonthlyTokens !== null &&
    (await tokensSince(startOfUtcMonth(), workspaceId)) >=
      budget.workspaceMonthlyTokens
  )
    throw new HTTPException(429, {
      message:
        "AI is paused for this workspace: monthly AI limit reached. It resets on the 1st (UTC).",
    });
}

export const monthTokens = (workspaceId: string) =>
  tokensSince(startOfUtcMonth(), workspaceId);
