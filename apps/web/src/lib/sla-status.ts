export type SlaStatus =
  | "low"
  | "medium"
  | "high"
  | "breached"
  | "achieved"
  | "failed";

const DAY_MS = 86_400_000;

/** Linear's SLA statuses: risk by time left, then achieved or failed once completed. */
export function getSlaStatus(
  task: { slaDueAt?: string | null; completedAt?: string | null },
  now = Date.now(),
): SlaStatus | null {
  if (!task.slaDueAt) return null;
  const due = new Date(task.slaDueAt).getTime();
  if (task.completedAt)
    return new Date(task.completedAt).getTime() <= due ? "achieved" : "failed";
  const left = due - now;
  if (left <= 0) return "breached";
  if (left <= DAY_MS) return "high";
  if (left <= 7 * DAY_MS) return "medium";
  return "low";
}
