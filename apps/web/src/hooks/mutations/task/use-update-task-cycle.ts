import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateTaskCycle from "@/fetchers/cycle/update-task-cycle";
import {
  applyOptimisticBoardPatch,
  rollbackOptimisticBoardPatch,
} from "@/lib/optimistic-board-task";
import type Task from "@/types/task";

type Input = { task: Pick<Task, "id" | "projectId">; cycleId: string | null };

export function useUpdateTaskCycle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ task, cycleId }: Input) => updateTaskCycle(task.id, cycleId),
    onMutate: ({ task, cycleId }: Input) =>
      applyOptimisticBoardPatch(queryClient, task, { cycleId }),
    onError: (_error, _input, context) =>
      rollbackOptimisticBoardPatch(queryClient, context),
    onSuccess: (_data, { task }) => {
      void queryClient.invalidateQueries({ queryKey: ["task", task.id] });
      void queryClient.invalidateQueries({
        queryKey: ["tasks", task.projectId],
      });
      void queryClient.invalidateQueries({ queryKey: ["activities", task.id] });
      void queryClient.invalidateQueries({ queryKey: ["cycles"] });
    },
  });
}
