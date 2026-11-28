import type { ProjectWithTasks } from "@/types/project";
import { periodStart } from "./compute-burn-up";
import { median } from "./compute-insights";

const WEEK = 7 * 86_400_000;
const ROLLING_WEEKS = 4;

/** Issues the team completed in the week that starts on Monday `start`. */
export type ThroughputWeek = {
  /** UTC Monday, ISO date. */
  key: string;
  start: number;
  count: number;
  /** Median of this week and the three before it. */
  rollingMedian: number;
};

/** Weekly team throughput over the last `weeks` weeks, empty weeks included. */
export function computeThroughput(
  project: ProjectWithTasks,
  weeks: number,
  now = Date.now(),
): ThroughputWeek[] {
  // Count the three weeks before the first one too, so its median is full.
  const span = weeks + ROLLING_WEEKS - 1;
  const first = periodStart(now, "week") - (span - 1) * WEEK;
  const counts = new Array<number>(span).fill(0);
  for (const column of project.columns)
    for (const task of column.tasks) {
      const done = Date.parse(task.completedAt ?? "");
      if (Number.isNaN(done) || done < first) continue;
      const index = Math.floor((periodStart(done, "week") - first) / WEEK);
      if (index < span) counts[index] += 1;
    }
  return counts.slice(ROLLING_WEEKS - 1).map((count, offset) => {
    const index = offset + ROLLING_WEEKS - 1;
    const start = first + index * WEEK;
    return {
      key: new Date(start).toISOString().slice(0, 10),
      start,
      count,
      rollingMedian: median(counts.slice(index - ROLLING_WEEKS + 1, index + 1)),
    };
  });
}
