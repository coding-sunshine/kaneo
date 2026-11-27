export type StatusChange = {
  at: Date;
  // Read from stored event data, which callers may have filled freely.
  oldStatus: unknown;
  newStatus: unknown;
};

export type StatusSpan = { status: string; totalMs: number; current: boolean };

const slugOf = (value: unknown) =>
  typeof value === "string" && value ? value : null;

/**
 * Cumulative time per status, in order of first entry. Changes must be sorted
 * oldest first. The open span belongs to the task's current status even when
 * the last event names another slug, such as one renamed since.
 */
export function computeStatusSpans(
  task: { status: string; createdAt: Date },
  changes: StatusChange[],
  now: Date,
): StatusSpan[] {
  const totals = new Map<string, number>();
  const add = (status: string | null, from: number, to: number) => {
    if (!status) return;
    totals.set(status, (totals.get(status) ?? 0) + Math.max(0, to - from));
  };

  let since = task.createdAt.getTime();
  let status = slugOf(changes[0]?.oldStatus);
  for (const change of changes) {
    const at = change.at.getTime();
    add(status, since, at);
    since = Math.max(since, at);
    status = slugOf(change.newStatus);
  }
  add(task.status, since, now.getTime());

  return [...totals].map(([slug, totalMs]) => ({
    status: slug,
    totalMs,
    current: slug === task.status,
  }));
}
