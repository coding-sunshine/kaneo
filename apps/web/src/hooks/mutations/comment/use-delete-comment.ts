import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteComment from "@/fetchers/comment/delete-comment";
import { invalidateLinkedDocuments } from "@/hooks/queries/document/invalidate-linked-documents";

function useDeleteComment(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteComment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities", taskId] });
      void queryClient.invalidateQueries({ queryKey: ["workspace-activity"] });
      void invalidateLinkedDocuments(queryClient, taskId);
    },
  });
}

export default useDeleteComment;
