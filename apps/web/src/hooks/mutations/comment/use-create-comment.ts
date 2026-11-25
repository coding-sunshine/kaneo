import { useMutation, useQueryClient } from "@tanstack/react-query";
import createComment from "@/fetchers/comment/create-comment";
import { invalidateLinkedDocuments } from "@/hooks/queries/document/invalidate-linked-documents";

function useCreateComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createComment,
    onSuccess: (_created, { taskId }) => {
      void queryClient.invalidateQueries({ queryKey: ["workspace-activity"] });
      void invalidateLinkedDocuments(queryClient, taskId);
    },
  });
}

export default useCreateComment;
