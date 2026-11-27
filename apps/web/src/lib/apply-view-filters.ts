import type { BoardFilters } from "@/hooks/use-task-filters";
import {
  type BlockingRelation,
  getBlockedTaskIds,
} from "@/lib/task-filters/blocked-task-ids";
import { filterProjectTasks } from "@/lib/task-filters/filter-project-tasks";
import { taskMatchesFilters } from "@/lib/task-filters/task-matches-filters";
import type { ProjectWithTasks } from "@/types/project";

/** Narrows a team's board to the filters saved with a view. */
export function applyViewFilters(
  project: ProjectWithTasks,
  filters: Partial<BoardFilters>,
  today = new Date(),
  relations?: readonly BlockingRelation[],
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
  const blockedTaskIds =
    full.workable || full.blocked
      ? getBlockedTaskIds(project, relations)
      : undefined;
  return filterProjectTasks(project, (task) =>
    taskMatchesFilters(task, full, {
      weekStartsOn: 1,
      today,
      blockedTaskIds,
      getCustomFieldValues: () => task.customFieldValues ?? [],
    }),
  );
}
