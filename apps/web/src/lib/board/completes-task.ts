import type { ProjectWithTasks } from "@/types/project";

/** Whether a board move takes any task from an open column into a final one. */
export function completesTask(
  board: ProjectWithTasks,
  tasks: { id: string; status?: string }[],
) {
  return tasks.some(({ id, status }) => {
    if (status === undefined) return false;
    const from = board.columns.find((c) => c.tasks.some((t) => t.id === id));
    const to = board.columns.find((c) => c.slug === status);
    return Boolean(to?.isFinal && from && !from.isFinal);
  });
}
