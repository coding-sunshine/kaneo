import type { GroupBy } from "@/lib/group-project";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";

/** Linear's Insights measures that Kaneo has data for (no Effort: no estimates). */
export type InsightMeasure =
  | "count"
  | "cycleTime"
  | "leadTime"
  | "triageTime"
  | "age";
export const INSIGHT_MEASURES: InsightMeasure[] = [
  "count",
  "cycleTime",
  "leadTime",
  "triageTime",
  "age",
];

export type GroupFn = (
  project: ProjectWithTasks,
  by: GroupBy,
) => ProjectWithTasks;

export type InsightPoint = { task: Task; days: number; segment: number };

export type InsightSlice = {
  key: string;
  name: string;
  /** Issues per segment, in segment order. A multi-label issue counts once per label. */
  counts: number[];
  /** Sum of counts: the bar height. */
  value: number;
  points: InsightPoint[];
  medianDays: number;
};

export type Insights = {
  segments: { key: string; name: string }[];
  slices: InsightSlice[];
  issueCount: number;
  maxValue: number;
  maxDays: number;
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
): Insights {
  const days = new Map<string, number>();
  for (const task of source.columns.flatMap((column) => column.tasks)) {
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
        for (const index of segments) counts[index] += 1;
        return { task, days: days.get(task.id) ?? 0, segment: segments[0] };
      });
      return {
        key: column.id,
        name: column.name,
        counts,
        value: counts.reduce((sum, count) => sum + count, 0),
        points,
        medianDays: median(points.map((point) => point.days)),
      };
    });

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
    maxDays: Math.max(
      0,
      ...slices.flatMap((item) => item.points.map((point) => point.days)),
    ),
  };
}
