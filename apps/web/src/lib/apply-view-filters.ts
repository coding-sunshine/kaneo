import type { BoardFilters } from "@/hooks/use-task-filters";
import { filterProjectTasks } from "@/lib/task-filters/filter-project-tasks";
import { taskMatchesFilters } from "@/lib/task-filters/task-matches-filters";
import type { ProjectWithTasks } from "@/types/project";

/** Narrows a team's board to the filters saved with a view. */
export function applyViewFilters(
  project: ProjectWithTasks,
  filters: Partial<BoardFilters>,
  today = new Date(),
): ProjectWithTasks {
  const full: BoardFilters = {
    status: null,
    priority: null,
    assignee: null,
    dueDate: null,
    labels: null,
    customFields: null,
    ...filters,
  };
  return filterProjectTasks(project, (task) =>
    taskMatchesFilters(task, full, {
      weekStartsOn: 1,
      today,
      getCustomFieldValues: () => task.customFieldValues ?? [],
    }),
  );
}
