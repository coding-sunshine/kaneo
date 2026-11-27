import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import useSetCommentReaction from "@/hooks/mutations/comment/use-set-comment-reaction";
import ReactionBar from "./reaction-bar";
import type { Reaction } from "./toggle-reaction";

type CommentReactionsProps = {
  commentId: string;
  taskId: string;
  reactions: Reaction[];
  className?: string;
};

export default function CommentReactions({
  commentId,
  taskId,
  reactions,
  className,
}: CommentReactionsProps) {
  const { user } = useAuth();
  const { mutate: setReaction } = useSetCommentReaction(taskId);

  return (
    <ReactionBar
      reactions={reactions}
      currentUserId={user?.id}
      onToggle={(emoji, reacted) =>
        setReaction({ activityId: commentId, emoji, reacted })
      }
      className={className}
    />
  );
}
