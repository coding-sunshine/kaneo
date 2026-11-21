import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toggleReaction } from "@/components/activity/toggle-reaction";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import type getActivitesByTaskId from "@/fetchers/activity/get-activites-by-task-id";
import setCommentReaction from "@/fetchers/comment/set-comment-reaction";

type Activities = Awaited<ReturnType<typeof getActivitesByTaskId>>;

function useSetCommentReaction(taskId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const queryKey = ["activities", taskId];

  return useMutation({
    mutationFn: setCommentReaction,
    onMutate: async ({ activityId, emoji, reacted }) => {
      if (!user?.id) return;
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueriesData<Activities>({ queryKey }, (activities) =>
        activities?.map((activity) =>
          activity.id === activityId
            ? {
                ...activity,
                reactions: toggleReaction(
                  activity.reactions,
                  emoji,
                  user.id,
                  reacted,
                ),
              }
            : activity,
        ),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}

export default useSetCommentReaction;
