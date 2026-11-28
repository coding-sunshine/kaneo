import { statusCategory } from "@/lib/status-category";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { median } from "./compute-insights";

const DAY = 86_400_000;

export type AgingItem = {
  task: Task;
  /** Days since the issue started. */
  days: number;
  /** The team's median cycle time, the bar the issue is past. */
  medianDays: number;
};

const span = (from?: string | null, to?: string | null) =>
  from && to ? (Date.parse(to) - Date.parse(from)) / DAY : null;

/**
 * In-progress issues older than their team's median cycle time, oldest first.
 * A team with nothing done yet is measured against the median age of its own
 * in-progress issues.
 */
export function computeAging(
  project: ProjectWithTasks,
  now = Date.now(),
): AgingItem[] {
  const cycleTimes = new Map<string, number[]>();
  const open: { task: Task; days: number }[] = [];
  for (const column of project.columns) {
    const category = statusCategory({
      id: column.slug ?? column.id,
      isFinal: column.isFinal,
    });
    for (const task of column.tasks) {
      if (category === "completed") {
        const days = span(task.startedAt, task.completedAt);
        if (days === null) continue;
        const team = cycleTimes.get(task.projectId) ?? [];
        team.push(days);
        cycleTimes.set(task.projectId, team);
      } else if (category === "started") {
        const since = task.startedAt ?? task.statusSince ?? task.createdAt;
        open.push({ task, days: Math.floor((now - Date.parse(since)) / DAY) });
      }
    }
  }

  const medianFor = new Map<string, number>();
  const teamMedian = (teamId: string) => {
    if (!medianFor.has(teamId)) {
      const done = cycleTimes.get(teamId);
      medianFor.set(
        teamId,
        done?.length
          ? median(done)
          : median(
              open
                .filter((item) => item.task.projectId === teamId)
                .map((item) => item.days),
            ),
      );
    }
    return medianFor.get(teamId) ?? 0;
  };

  return open
    .map((item) => ({ ...item, medianDays: teamMedian(item.task.projectId) }))
    .filter((item) => item.days > item.medianDays)
    .sort((a, b) => b.days - a.days);
}
