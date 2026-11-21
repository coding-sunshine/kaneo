import type { QueryClient } from "@tanstack/react-query";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { patchBoardTask } from "./patch-board-task";

type OptimisticContext = {
  projectId: string;
  previous: ProjectWithTasks | undefined;
};

/** Apply `fields` to the cached board at once; returns a snapshot for rollback. */
export async function applyOptimisticBoardPatch(
  queryClient: QueryClient,
  task: Pick<Task, "id" | "projectId">,
  fields: Partial<Task>,
): Promise<OptimisticContext> {
  const queryKey = ["tasks", task.projectId];
  await queryClient.cancelQueries({ queryKey });
  const previous = queryClient.getQueryData<ProjectWithTasks>(queryKey);
  queryClient.setQueryData<ProjectWithTasks>(queryKey, (board) =>
    board
      ? (patchBoardTask(board, task.id, {
          ...fields,
          projectId: task.projectId,
        }) ?? board)
      : board,
  );
  return { projectId: task.projectId, previous };
}

export function rollbackOptimisticBoardPatch(
  queryClient: QueryClient,
  context: OptimisticContext | undefined,
) {
  if (context?.previous)
    queryClient.setQueryData(["tasks", context.projectId], context.previous);
}
