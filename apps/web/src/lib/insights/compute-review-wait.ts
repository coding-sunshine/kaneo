import type { ProjectWithTasks } from "@/types/project";
import { median } from "./compute-insights";

const DAY = 86_400_000;
const REVIEW_STATUS = "in-review";

export type ReviewWait = {
  count: number;
  medianDays: number;
  longestDays: number;
};

/** How long the issues now in review have waited there, in days. */
export function computeReviewWait(
  project: ProjectWithTasks,
  now = Date.now(),
): ReviewWait {
  const waits = project.columns
    .filter((column) => (column.slug ?? column.id) === REVIEW_STATUS)
    .flatMap((column) => column.tasks)
    .flatMap((task) =>
      task.statusSince
        ? [Math.floor((now - Date.parse(task.statusSince)) / DAY)]
        : [],
    );
  return {
    count: waits.length,
    medianDays: median(waits),
    longestDays: waits.length ? Math.max(...waits) : 0,
  };
}
