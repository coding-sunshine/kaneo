import type { ProjectWithTasks } from "@/types/project";
import type { Insights } from "./compute-insights";

/** What the user clicked: a slice (bar, row), a segment (column), or both (cell). */
export type InsightSelection = { slice?: string; segment?: number };

export const sameSelection = (
  a: InsightSelection | null,
  b: InsightSelection,
) => a?.slice === b.slice && a?.segment === b.segment;

/** Clicking the selection again clears it. */
export const toggleSelection = (
  current: InsightSelection | null,
  next: InsightSelection,
) => (sameSelection(current, next) ? null : next);

/** Ids of the issues a selection covers; null when nothing is selected. */
export function selectedIssueIds(
  insights: Insights,
  selection: InsightSelection | null,
) {
  if (!selection) return null;
  const ids = new Set<string>();
  for (const slice of insights.slices) {
    if (selection.slice !== undefined && slice.key !== selection.slice)
      continue;
    for (const point of slice.points) {
      if (
        selection.segment === undefined ||
        point.segments.includes(selection.segment)
      ) {
        ids.add(point.task.id);
      }
    }
  }
  return ids;
}

/** The project with only the given issues; unchanged when `ids` is null. */
export function narrowToIssues(
  project: ProjectWithTasks,
  ids: ReadonlySet<string> | null,
): ProjectWithTasks {
  if (!ids) return project;
  return {
    ...project,
    columns: project.columns.map((column) => ({
      ...column,
      tasks: column.tasks.filter((task) => ids.has(task.id)),
    })),
  };
}
