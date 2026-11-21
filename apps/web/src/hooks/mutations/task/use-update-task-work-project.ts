import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateTaskWorkProject from "@/fetchers/work-project/update-task-work-project";
import { invalidateWorkProjects } from "@/hooks/mutations/work-project/invalidate-work-projects";
import {
  applyOptimisticBoardPatch,
  rollbackOptimisticBoardPatch,
} from "@/lib/optimistic-board-task";
import type Task from "@/types/task";

type Input = {
  task: Pick<Task, "id" | "projectId">;
  workProjectId: string | null;
  workProjectMilestoneId?: string | null;
};

export function useUpdateTaskWorkProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ task, workProjectId, workProjectMilestoneId }: Input) =>
      updateTaskWorkProject(task.id, workProjectId, workProjectMilestoneId),
    onMutate: ({ task, workProjectId, workProjectMilestoneId }: Input) =>
      applyOptimisticBoardPatch(queryClient, task, {
        workProjectId,
        workProjectMilestoneId: workProjectMilestoneId ?? null,
      }),
    onError: (_error, _input, context) =>
      rollbackOptimisticBoardPatch(queryClient, context),
    onSuccess: (_data, { task }) => {
      void queryClient.invalidateQueries({ queryKey: ["task", task.id] });
      void queryClient.invalidateQueries({
        queryKey: ["tasks", task.projectId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["activities", task.id],
      });
      invalidateWorkProjects(queryClient);
    },
  });
}
