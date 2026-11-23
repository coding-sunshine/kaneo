import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteTaskDraft } from "@/fetchers/task-draft/task-drafts";
import { taskDraftsKey } from "@/hooks/queries/task-draft/use-task-drafts";

export function useDeleteTaskDraft(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTaskDraft(workspaceId ?? "", id),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: taskDraftsKey(workspaceId ?? ""),
      }),
  });
}
