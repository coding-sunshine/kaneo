import { useMutation, useQueryClient } from "@tanstack/react-query";
import setCommentThreadResolved from "@/fetchers/comment/set-comment-thread-resolved";

function useSetCommentThreadResolved(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setCommentThreadResolved,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["activities", taskId] }),
  });
}

export default useSetCommentThreadResolved;
