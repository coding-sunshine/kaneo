import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  saveTaskDraft,
  type TaskDraftInput,
} from "@/fetchers/task-draft/task-drafts";
import { taskDraftsKey } from "@/hooks/queries/task-draft/use-task-drafts";

export function useSaveTaskDraft(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, id }: { input: TaskDraftInput; id?: string }) =>
      saveTaskDraft(workspaceId ?? "", input, id),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: taskDraftsKey(workspaceId ?? ""),
      }),
  });
}
