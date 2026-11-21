import { useMutation, useQueryClient } from "@tanstack/react-query";
import setCommentThreadSubscribed from "@/fetchers/comment/set-comment-thread-subscribed";

function useSetCommentThreadSubscribed(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setCommentThreadSubscribed,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["activities", taskId] }),
  });
}

export default useSetCommentThreadSubscribed;
