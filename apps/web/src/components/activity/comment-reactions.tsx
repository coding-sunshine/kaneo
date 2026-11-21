import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import useSetCommentReaction from "@/hooks/mutations/comment/use-set-comment-reaction";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import useGetWorkspaceUsers from "@/hooks/queries/workspace-users/use-get-workspace-users";
import { cn } from "@/lib/cn";
import AddReactionButton from "./add-reaction-button";
import EmojiGlyph from "./emoji-picker/emoji-glyph";
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
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: workspace } = useActiveWorkspace();
  const { data: members } = useGetWorkspaceUsers({
    workspaceId: workspace?.id,
  });
  const { mutate: setReaction } = useSetCommentReaction(taskId);
  const nameOf = (id: string) =>
    members?.find((member) => member.user?.id === id)?.user?.name ??
    t("common:people.someone");
  const names = new Intl.ListFormat(undefined, { type: "conjunction" });

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {reactions.map(({ emoji, userIds }) => {
        const mine = Boolean(user?.id && userIds.includes(user.id));
        return (
          <Tooltip key={emoji}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-pressed={mine}
                onClick={() =>
                  setReaction({ activityId: commentId, emoji, reacted: !mine })
                }
                className={cn(
                  "flex h-6 items-center gap-1 rounded-full border px-2 text-xs tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  mine
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-foreground/20",
                )}
              >
                <span className="flex text-sm leading-none">
                  <EmojiGlyph emoji={emoji} />
                </span>
                {userIds.length}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                {t("activity:reactions.reactedBy", {
                  names: names.format(userIds.map(nameOf)),
                  emoji,
                })}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}
      <AddReactionButton
        className="rounded-full"
        onSelect={(emoji) =>
          setReaction({ activityId: commentId, emoji, reacted: true })
        }
      />
    </div>
  );
}
