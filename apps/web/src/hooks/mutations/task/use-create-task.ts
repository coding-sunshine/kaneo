import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateMyWork } from "@/lib/invalidate-my-work";
import createTask, {
  type CreateTaskRequest,
} from "@/fetchers/task/create-task";
import { trackFirstTask } from "@/lib/analytics/activation";

function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      title,
      description,
      userId,
      projectId,
      status,
      startDate,
      dueDate,
      priority,
      customFields,
      draftAssetIds,
      recurrence,
      workProjectId,
      workProjectMilestoneId,
      cycleId,
      sourceCommentId,
      sourceMessage,
      topicId,
    }: CreateTaskRequest) =>
      createTask(
        title,
        description,
        projectId,
        userId,
        status,
        startDate ? new Date(startDate) : undefined,
        dueDate ? new Date(dueDate) : undefined,
        priority,
        customFields,
        draftAssetIds,
        recurrence,
        { workProjectId, workProjectMilestoneId },
        cycleId,
        sourceCommentId,
        topicId,
        sourceMessage,
      ),
    onSuccess: (_data, variables) => {
      invalidateMyWork(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      void queryClient.invalidateQueries({ queryKey: ["work-projects"] });
      void queryClient.invalidateQueries({ queryKey: ["cycles"] });
      void queryClient.invalidateQueries({ queryKey: ["work-project"] });
      trackFirstTask();
      void queryClient.invalidateQueries({
        queryKey: ["tasks", variables.projectId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["custom-field-values", variables.projectId],
      });
      // The source comment now lists the new issue.
      if (variables.sourceCommentId)
        void queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export default useCreateTask;
