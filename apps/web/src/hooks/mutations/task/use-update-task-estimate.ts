import {
  getBoardCacheVersion,
  markBoardCacheChanged,
} from "@/lib/board-cache-version";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateTaskEstimate from "@/fetchers/task/update-task-estimate";
import {
  applyOptimisticBoardPatch,
  rollbackOptimisticBoardPatch,
} from "@/lib/optimistic-board-task";
import type Task from "@/types/task";
import { updateBoardTaskCache } from "@/lib/update-board-task-cache";

export function useUpdateTaskEstimate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (task: Task) =>
      updateTaskEstimate(task.id, task.estimate ?? null),
    onMutate: async (task: Task) => {
      markBoardCacheChanged(queryClient, task.projectId, task.id);
      const rollback = await applyOptimisticBoardPatch(queryClient, task, {
        estimate: task.estimate ?? null,
      });
      return {
        ...rollback,
        version: getBoardCacheVersion(queryClient, task.projectId, task.id),
      };
    },
    onError: (_error, _task, context) =>
      rollbackOptimisticBoardPatch(queryClient, context),
    onSuccess: (updated, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ["task", variables.id] });
      updateBoardTaskCache(
        queryClient,
        variables.projectId,
        variables.id,
        { estimate: updated.estimate ?? null },
        context?.version,
      );
      queryClient.invalidateQueries({
        queryKey: ["activities", variables.id],
      });
    },
  });
}
