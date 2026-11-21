import { and, asc, eq, gt, isNull, lte, sql } from "drizzle-orm";
import db from "../database";
import {
  columnTable,
  cycleTable,
  projectTable,
  taskTable,
} from "../database/schema";

const WEEK = 7 * 24 * 3600 * 1000;
// Statuses before work starts; any other open status counts as "started".
export const UNSTARTED = ["triage", "backlog", "todo"];

// Linear starts a team's cycles at midnight on the start day; we use UTC.
// ponytail: team time zones, add a project time zone column if needed.
function weekStart(now: Date, startDay: number) {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() - startDay + 7) % 7));
  return d;
}

/**
 * Idempotent: creates missing upcoming cycles, completes ended ones and rolls
 * their unfinished issues into the next cycle. Safe to call from a cron tick
 * and on every read; the advisory lock serialises concurrent callers.
 */
export async function reconcileCycles(projectId: string, now = new Date()) {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(1525, hashtext(${projectId}))`,
    );
    const [project] = await tx
      .select()
      .from(projectTable)
      .where(eq(projectTable.id, projectId));
    if (!project?.cyclesEnabled) return;

    const cycles = await tx
      .select()
      .from(cycleTable)
      .where(eq(cycleTable.projectId, projectId))
      .orderBy(asc(cycleTable.number));

    for (let guard = 0; guard < 100; guard++) {
      const last = cycles.at(-1);
      const upcoming = cycles.filter((c) => c.startsAt > now).length;
      if (last && last.endsAt > now && upcoming >= project.cycleUpcomingCount)
        break;
      const startsAt = last
        ? new Date(last.endsAt.getTime() + project.cycleCooldownWeeks * WEEK)
        : weekStart(now, project.cycleStartDay);
      const [created] = await tx
        .insert(cycleTable)
        .values({
          projectId,
          number: (last?.number ?? 0) + 1,
          startsAt,
          endsAt: new Date(
            startsAt.getTime() + project.cycleDurationWeeks * WEEK,
          ),
        })
        .returning();
      if (created) cycles.push(created);
    }

    for (const [i, cycle] of cycles.entries()) {
      if (cycle.completedAt || cycle.endsAt > now) continue;
      const next = cycles[i + 1];
      if (project.cycleAutoRollover && next) {
        await tx
          .update(taskTable)
          .set({ cycleId: next.id })
          .where(
            and(
              eq(taskTable.cycleId, cycle.id),
              isNull(taskTable.archivedAt),
              sql`${taskTable.status} not in (select ${columnTable.slug} from ${columnTable} where ${columnTable.projectId} = ${projectId} and ${columnTable.isFinal})`,
            ),
          );
      }
      await tx
        .update(cycleTable)
        .set({ completedAt: cycle.endsAt })
        .where(eq(cycleTable.id, cycle.id));
    }
  });
}

export async function reconcileAllCycles() {
  const rows = await db
    .select({ id: projectTable.id })
    .from(projectTable)
    .where(eq(projectTable.cyclesEnabled, true));
  for (const { id } of rows) await reconcileCycles(id);
}

// Linear: an issue that starts (or completes) joins the current cycle when it has none.
export async function autoAddToCurrentCycle(
  taskId: string,
  projectId: string,
  status: string,
) {
  const [project] = await db
    .select()
    .from(projectTable)
    .where(eq(projectTable.id, projectId));
  if (!project?.cyclesEnabled) return;
  const [column] = await db
    .select({ isFinal: columnTable.isFinal })
    .from(columnTable)
    .where(
      and(eq(columnTable.projectId, projectId), eq(columnTable.slug, status)),
    );
  if (status === "canceled" || UNSTARTED.includes(status)) return;
  if (
    column?.isFinal
      ? !project.cycleAutoAddCompleted
      : !project.cycleAutoAddStarted
  )
    return;
  const now = new Date();
  const [current] = await db
    .select({ id: cycleTable.id })
    .from(cycleTable)
    .where(
      and(
        eq(cycleTable.projectId, projectId),
        lte(cycleTable.startsAt, now),
        gt(cycleTable.endsAt, now),
      ),
    );
  if (!current) return;
  await db
    .update(taskTable)
    .set({ cycleId: current.id })
    .where(and(eq(taskTable.id, taskId), isNull(taskTable.cycleId)));
}
