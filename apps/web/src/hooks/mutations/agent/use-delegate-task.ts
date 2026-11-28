import { useMutation, useQueryClient } from "@tanstack/react-query";
import { delegateTask } from "@/fetchers/agent/delegation";
import { taskProposalsKey } from "@/hooks/queries/agent/use-task-proposals";

/** Puts a delegation card on the ticket; nothing runs until it is accepted. */
export function useDelegateTask(workspaceId: string, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => delegateTask(workspaceId, taskId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: taskProposalsKey(workspaceId, taskId),
      }),
  });
}
