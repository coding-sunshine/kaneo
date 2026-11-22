import type { ProjectWithTasks } from "@/types/project";

export type BurnUpInterval = "month" | "week";
export const BURN_UP_INTERVALS: BurnUpInterval[] = ["month", "week"];

/** Cumulative issue counts as of the end of the period that starts at `start`. */
export type BurnUpBucket = {
  /** UTC start of the period, ISO date. */
  key: string;
  start: number;
  created: number;
  started: number;
  completed: number;
};

const DAY = 86_400_000;

function periodStart(ms: number, interval: BurnUpInterval) {
  const d = new Date(ms);
  return interval === "month"
    ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
    : // Weeks start on Monday.
      Date.UTC(
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate() - ((d.getUTCDay() + 6) % 7),
      );
}

function periodEnd(start: number, interval: BurnUpInterval) {
  const d = new Date(start);
  return interval === "month"
    ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)
    : start + 7 * DAY;
}

/**
 * Linear's burn-up: how many issues were created, started and completed by
 * the end of each period, from the first issue to the current period.
 * Kaneo stores no cancellation time, so there is no canceled series.
 */
export function computeBurnUp(
  source: ProjectWithTasks,
  interval: BurnUpInterval,
  now = Date.now(),
): BurnUpBucket[] {
  const tasks = source.columns.flatMap((column) => column.tasks);
  const times = (
    pick: (task: (typeof tasks)[number]) => string | null | undefined,
  ) =>
    tasks.flatMap((task) => {
      const ms = Date.parse(pick(task) ?? "");
      return Number.isNaN(ms) ? [] : [ms];
    });
  const created = times((task) => task.createdAt);
  const started = times((task) => task.startedAt);
  const completed = times((task) => task.completedAt);
  if (created.length === 0) return [];

  const first = periodStart(Math.min(...created), interval);
  const last = periodStart(now, interval);
  const buckets: BurnUpBucket[] = [];
  for (let start = first; start <= last; start = periodEnd(start, interval)) {
    const end = periodEnd(start, interval);
    const upTo = (list: number[]) => list.filter((ms) => ms < end).length;
    buckets.push({
      key: new Date(start).toISOString().slice(0, 10),
      start,
      created: upTo(created),
      started: upTo(started),
      completed: upTo(completed),
    });
  }
  return buckets;
}
