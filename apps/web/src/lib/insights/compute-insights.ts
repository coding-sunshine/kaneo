import type { GroupBy } from "@/lib/group-project";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";

/** Linear's Insights measures. Effort is the total estimate, offered only for estimating teams. */
export type InsightMeasure =
  | "count"
  | "effort"
  | "cycleTime"
  | "leadTime"
  | "triageTime"
  | "age";
export const INSIGHT_MEASURES: InsightMeasure[] = [
  "count",
  "effort",
  "cycleTime",
  "leadTime",
  "triageTime",
  "age",
];

export type GroupFn = (
  project: ProjectWithTasks,
  by: GroupBy,
) => ProjectWithTasks;

export type InsightPoint = {
  task: Task;
  days: number;
  /** The segment that colours the point; `segments` lists every one it is in. */
  segment: number;
  segments: number[];
};

export type InsightSlice = {
  key: string;
  name: string;
  /** Issues (points, for effort) per segment, in segment order. A multi-label issue counts once per label. */
  counts: number[];
  /** Sum of counts: the bar height. */
  value: number;
  points: InsightPoint[];
  medianDays: number;
  /** 25/50/75/95% of the slice's measured time (issue age for the count bars). */
  percentiles: { percent: number; days: number }[];
};

export type Insights = {
  segments: { key: string; name: string }[];
  slices: InsightSlice[];
  issueCount: number;
  maxValue: number;
  maxDays: number;
  /** Linear's scatter markers: the time 25/50/75/95% of plotted issues take or less. */
  percentiles: { percent: number; days: number }[];
};

const DAY = 86_400_000;

const span = (from?: string | null, to?: string | null) =>
  from && to ? Math.max(0, (Date.parse(to) - Date.parse(from)) / DAY) : null;

/** Days per issue; null leaves the issue out, like Linear's automatic filters. */
function measureDays(measure: InsightMeasure, task: Task, now: number) {
  switch (measure) {
    case "cycleTime":
      return span(task.startedAt, task.completedAt);
    case "leadTime":
      return span(task.createdAt, task.completedAt);
    case "triageTime":
      return span(task.startedTriageAt, task.triagedAt);
    default:
      return Math.max(0, (now - Date.parse(task.createdAt)) / DAY);
  }
}

const PERCENTS = [25, 50, 75, 95];

const percentilesOf = (sorted: number[]) =>
  sorted.length
    ? PERCENTS.map((percent) => ({
        percent,
        days: percentile(sorted, percent),
      }))
    : [];

/** Nearest rank: the smallest value with at least `percent`% of values at or below it. */
function percentile(sorted: number[], percent: number) {
  return sorted[Math.max(0, Math.ceil((percent / 100) * sorted.length) - 1)];
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Buckets the issues in view by `slice` (x-axis) and colours them by
 * `segment`, reusing the list view's grouping so names match it.
 */
export function computeInsights(
  source: ProjectWithTasks,
  measure: InsightMeasure,
  slice: GroupBy,
  segment: GroupBy,
  group: GroupFn,
  now = Date.now(),
  /** Points an issue adds to effort; 0 leaves it out. */
  weight: (task: Task) => number = () => 1,
): Insights {
  const days = new Map<string, number>();
  for (const task of source.columns.flatMap((column) => column.tasks)) {
    if (measure === "effort" && weight(task) === 0) continue;
    const value = measureDays(measure, task, now);
    if (value !== null) days.set(task.id, value);
  }
  const project = {
    ...source,
    columns: source.columns.map((column) => ({
      ...column,
      tasks: column.tasks.filter((task) => days.has(task.id)),
    })),
  };
  const segmentColumns = group(project, segment).columns.filter(
    (column) => column.tasks.length > 0,
  );
  const membership = new Map<string, number[]>();
  segmentColumns.forEach((column, index) => {
    for (const task of column.tasks) {
      membership.set(task.id, [...(membership.get(task.id) ?? []), index]);
    }
  });

  const slices = group(project, slice)
    .columns.filter((column) => column.tasks.length > 0)
    .map((column) => {
      const counts = segmentColumns.map(() => 0);
      const points = column.tasks.map((task) => {
        const segments = membership.get(task.id) ?? [0];
        const added = measure === "effort" ? weight(task) : 1;
        for (const index of segments) counts[index] += added;
        return {
          task,
          days: days.get(task.id) ?? 0,
          segment: segments[0],
          segments,
        };
      });
      return {
        key: column.id,
        name: column.name,
        counts,
        value: counts.reduce((sum, count) => sum + count, 0),
        points,
        medianDays: median(points.map((point) => point.days)),
        percentiles: percentilesOf(
          points.map((point) => point.days).sort((a, b) => a - b),
        ),
      };
    });

  // One value per issue, even when a multi-label issue sits in several slices.
  const sorted = [...days.values()].sort((a, b) => a - b);
  const issueIds = new Set(
    project.columns.flatMap((column) => column.tasks.map((task) => task.id)),
  );

  return {
    segments: segmentColumns.map((column) => ({
      key: column.id,
      name: column.name,
    })),
    slices,
    issueCount: issueIds.size,
    maxValue: Math.max(0, ...slices.map((item) => item.value)),
    maxDays: Math.max(0, ...sorted),
    percentiles: percentilesOf(sorted),
  };
}
