import { pullRequestKey } from "@/lib/pull-request-key";

export type SnoozeMode = "newComment" | "newReview";

/** What the snooze captured, so a later change on the pull request can end it. */
export type SnoozeEntry = {
  /** ISO time the snooze ends; absent for the "until new ..." modes. */
  until?: string;
  mode?: SnoozeMode;
  updatedAt: string;
  comments: number;
};

type SnoozeSubject = { updatedAt: string; comments: number };
type PullKeyParts = { owner: string; repo: string; number: number };

// ponytail: the list exposes no review timestamps, so "new review" watches
// GitHub's updatedAt (any activity) and "new comment" the comment count.
// Upgrade once the API returns the latest review time.
export function isSnoozed(
  entry: SnoozeEntry | undefined,
  pull: SnoozeSubject,
  now = new Date(),
) {
  if (!entry) return false;
  if (entry.until) return new Date(entry.until) > now;
  if (entry.mode === "newComment") return pull.comments <= entry.comments;
  if (entry.mode === "newReview") return pull.updatedAt <= entry.updatedAt;
  return false;
}

export const entryFor = (
  pull: SnoozeSubject,
  when: { until: Date } | { mode: SnoozeMode },
): SnoozeEntry => ({
  ...("until" in when ? { until: when.until.toISOString() } : when),
  updatedAt: pull.updatedAt,
  comments: pull.comments,
});

/** Splits rows into those still showing and those snoozed now, keeping order. */
export function splitSnoozed<T extends SnoozeSubject & PullKeyParts>(
  items: T[],
  entries: Record<string, SnoozeEntry>,
  now = new Date(),
) {
  const active: T[] = [];
  const snoozed: T[] = [];
  for (const pr of items) {
    const key = pullRequestKey({ ...pr, number: String(pr.number) });
    (isSnoozed(entries[key], pr, now) ? snoozed : active).push(pr);
  }
  return { active, snoozed };
}
