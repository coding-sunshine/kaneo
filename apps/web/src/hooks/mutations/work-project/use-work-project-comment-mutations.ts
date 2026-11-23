import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createWorkProjectComment,
  deleteWorkProjectComment,
  editWorkProjectComment,
} from "@/fetchers/work-project/comments";

function useRefresh(workProjectId: string) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: ["work-project", workProjectId, "comments"],
    });
}

export function useCreateWorkProjectComment(workProjectId: string) {
  const refresh = useRefresh(workProjectId);
  return useMutation({
    mutationFn: (content: string) =>
      createWorkProjectComment(workProjectId, content),
    onSuccess: refresh,
  });
}

export function useEditWorkProjectComment(workProjectId: string) {
  const refresh = useRefresh(workProjectId);
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      editWorkProjectComment(id, content),
    onSuccess: refresh,
  });
}

export function useDeleteWorkProjectComment(workProjectId: string) {
  const refresh = useRefresh(workProjectId);
  return useMutation({
    mutationFn: deleteWorkProjectComment,
    onSuccess: refresh,
  });
}
