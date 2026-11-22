import { type StatusCategory, statusCategory } from "@/lib/status-category";
import type { ProjectWithTasks } from "@/types/project";

const ORDER: StatusCategory[] = [
  "triage",
  "backlog",
  "unstarted",
  "started",
  "completed",
  "canceled",
];

/**
 * One dataset for a view across teams. Columns are keyed by status slug, so
 * each team's "Todo" lands in one slice instead of one bar per team. Slices
 * keep Linear's workflow order even when only a later team has Triage.
 */
export function mergeTeamIssues(
  boards: ProjectWithTasks[],
): ProjectWithTasks | undefined {
  const [first] = boards;
  if (!first) return undefined;
  const columns = new Map<string, ProjectWithTasks["columns"][number]>();
  for (const board of boards) {
    for (const column of board.columns) {
      // Keep each issue's own team key (CON-12, ENG-4) once teams share a column.
      const tasks = column.tasks.map((task) => ({
        ...task,
        teamSlug: task.teamSlug ?? board.slug,
      }));
      const seen = columns.get(column.id);
      columns.set(
        column.id,
        seen
          ? { ...seen, tasks: [...seen.tasks, ...tasks] }
          : { ...column, tasks },
      );
    }
  }
  const rank = (column: ProjectWithTasks["columns"][number]) =>
    ORDER.indexOf(statusCategory(column));
  return {
    ...first,
    archivedTasks: boards.flatMap((board) => board.archivedTasks ?? []),
    columns: [...columns.values()].sort((a, b) => rank(a) - rank(b)),
  };
}
