import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateComment from "@/fetchers/comment/update-comment";
import { invalidateLinkedDocuments } from "@/hooks/queries/document/invalidate-linked-documents";

function useUpdateComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateComment,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workspace-activity"] });
      void invalidateLinkedDocuments(queryClient);
    },
  });
}

export default useUpdateComment;
