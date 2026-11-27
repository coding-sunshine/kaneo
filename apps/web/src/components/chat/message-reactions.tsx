import ReactionBar from "@/components/activity/reaction-bar";
import type { Reaction } from "@/components/activity/toggle-reaction";
import { useReactToMessage } from "@/hooks/mutations/chat/use-message-mutations";
import { toast } from "@/lib/toast";

type MessageReactionsProps = {
  workspaceId: string;
  channelId: string;
  messageId: string;
  currentUserId: string | undefined;
  reactions: Reaction[];
  canReact: boolean;
};

export function MessageReactions({
  workspaceId,
  channelId,
  messageId,
  currentUserId,
  reactions,
  canReact,
}: MessageReactionsProps) {
  const react = useReactToMessage(workspaceId, channelId);
  if (!canReact && reactions.length === 0) return null;

  return (
    <ReactionBar
      reactions={reactions}
      currentUserId={currentUserId}
      canReact={canReact}
      onToggle={(emoji, reacted) =>
        react.mutate(
          { messageId, emoji, reacted },
          { onError: (error) => toast.error(error.message) },
        )
      }
    />
  );
}
