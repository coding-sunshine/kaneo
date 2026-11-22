import { and, asc, eq, lte } from "drizzle-orm";
import db from "../database";
import { loopTable } from "../database/schema";
import { isAgentEnabled } from "../agent/openrouter";
import { executeLoop } from "../loop/run-loop";
import { nextRunAfter } from "../loop/schedule";
import { withJobLease } from "./leader-lock";

const BATCH_SIZE = 10;

export async function runDueLoops(): Promise<{ degraded: boolean }> {
  if (!isAgentEnabled()) return { degraded: false };
  return withJobLease("loops", runBatch, () => ({ degraded: false }));
}

async function runBatch(): Promise<{ degraded: boolean }> {
  const now = new Date();
  const due = await db
    .select()
    .from(loopTable)
    .where(
      and(
        eq(loopTable.enabled, true),
        eq(loopTable.trigger, "schedule"),
        lte(loopTable.nextRunAt, now),
      ),
    )
    .orderBy(asc(loopTable.nextRunAt))
    .limit(BATCH_SIZE);

  let degraded = false;
  for (const loop of due) {
    // Advancing nextRunAt first claims the tick: a missed window runs once,
    // not once per missed interval, and a second instance skips it.
    if (!loop.frequency || !loop.nextRunAt) continue;
    const [claimed] = await db
      .update(loopTable)
      .set({ nextRunAt: nextRunAfter(loop.frequency, now) })
      .where(
        and(eq(loopTable.id, loop.id), eq(loopTable.nextRunAt, loop.nextRunAt)),
      )
      .returning({ id: loopTable.id });
    if (!claimed) continue;
    try {
      const run = await executeLoop(loop, "schedule");
      if (run.status === "failed") degraded = true;
    } catch (error) {
      degraded = true;
      console.error(`loops: run for ${loop.id} failed`, error);
    }
  }
  return { degraded };
}
