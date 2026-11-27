import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateMyWork } from "@/lib/invalidate-my-work";
import updateTaskStatus from "@/fetchers/task/update-task-status";
import { celebrateCompletion } from "@/lib/completion-celebration";
import { isPerTaskRelationQuery } from "@/lib/relation-query-keys";
import {
  applyOptimisticBoardPatch,
  rollbackOptimisticBoardPatch,
} from "@/lib/optimistic-board-task";
import type Task from "@/types/task";

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (task: Task) => updateTaskStatus(task.id, task),
    onMutate: (task: Task) =>
      applyOptimisticBoardPatch(queryClient, task, {
        status: task.status,
        statusSince: new Date().toISOString(),
      }),
    onError: (_error, _task, context) =>
      rollbackOptimisticBoardPatch(queryClient, context),
    onSuccess: (result, variables) => {
      if (result.completedAt && !variables.completedAt) celebrateCompletion();
      invalidateMyWork(queryClient);
      queryClient.invalidateQueries({
        queryKey: ["task", variables.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["tasks", variables.projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["notifications"],
      });
      queryClient.invalidateQueries({
        queryKey: ["projects"],
      });
      queryClient.invalidateQueries({
        queryKey: ["activities", variables.id],
      });
      // Per-task relation responses embed the linked tasks' status and
      // assignee, so they stale here; the project-scoped query returns edges
      // alone and does not.
      queryClient.invalidateQueries({ predicate: isPerTaskRelationQuery });
    },
  });
}
