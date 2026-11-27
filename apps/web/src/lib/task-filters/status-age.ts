import type Task from "@/types/task";

const DAY_MS = 86_400_000;

/** Day thresholds offered for each status in the filter menu. */
export const STATUS_AGE_DAYS = [1, 3, 7, 14, 30];

/** "In <status> for more than <days> days", stored as `<status>:<days>`. */
export type StatusAge = { status: string; days: number };

export function serializeStatusAge({ status, days }: StatusAge) {
  return `${status}:${days}`;
}

export function parseStatusAge(value: string): StatusAge | null {
  const split = value.lastIndexOf(":");
  const status = value.slice(0, split);
  const days = value.slice(split + 1);
  if (split <= 0 || !/^\d+$/.test(days)) return null;
  return { status, days: Number(days) };
}

export function matchesStatusAge(task: Task, value: string, now: Date) {
  const condition = parseStatusAge(value);
  if (!condition || task.status !== condition.status || !task.statusSince)
    return false;
  return now.getTime() - Date.parse(task.statusSince) > condition.days * DAY_MS;
}
