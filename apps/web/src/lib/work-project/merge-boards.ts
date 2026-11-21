import { GROUP_ID_PREFIX } from "@/lib/group-project";
import type { ProjectWithTasks } from "@/types/project";

/**
 * Folds the boards of several teams into one pseudo board holding only the
 * tasks of one work project. Columns are merged by status name; ids carry the
 * group prefix so nothing mistakes them for real statuses.
 */
export function mergeBoardsForWorkProject(
  boards: ProjectWithTasks[],
  workProjectId: string,
): ProjectWithTasks | undefined {
  const first = boards[0];
  if (!first) return undefined;
  const merged = new Map<string, ProjectWithTasks["columns"][number]>();

  for (const board of boards) {
    for (const column of board.columns) {
      const tasks = column.tasks
        .filter((task) => task.workProjectId === workProjectId)
        .map((task) => ({ ...task, teamSlug: board.slug ?? undefined }));
      if (tasks.length === 0) continue;
      const existing = merged.get(column.name);
      if (existing) existing.tasks.push(...tasks);
      else
        merged.set(column.name, {
          ...column,
          id: `${GROUP_ID_PREFIX}${column.name}`,
          tasks: [...tasks],
        });
    }
  }

  return {
    ...first,
    id: `work-project:${workProjectId}`,
    columns: [...merged.values()],
    archivedTasks: [],
    plannedTasks: [],
  };
}
