import { useTranslation } from "react-i18next";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import useGetWorkspaceUsers from "@/hooks/queries/workspace-users/use-get-workspace-users";
import { cn } from "@/lib/cn";
import AddReactionButton from "./add-reaction-button";
import EmojiGlyph from "./emoji-picker/emoji-glyph";
import type { Reaction } from "./toggle-reaction";

type ReactionBarProps = {
  reactions: Reaction[];
  currentUserId: string | undefined;
  onToggle: (emoji: string, reacted: boolean) => void;
  /** False shows the reactions read-only, without the add button. */
  canReact?: boolean;
  className?: string;
};

/** Emoji chips with counts and who reacted, plus the add-reaction picker. */
export default function ReactionBar({
  reactions,
  currentUserId,
  onToggle,
  canReact = true,
  className,
}: ReactionBarProps) {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const { data: members } = useGetWorkspaceUsers({
    workspaceId: workspace?.id,
  });
  const nameOf = (id: string) =>
    members?.find((member) => member.user?.id === id)?.user?.name ??
    t("common:people.someone");
  const names = new Intl.ListFormat(undefined, { type: "conjunction" });

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {reactions.map(({ emoji, userIds }) => {
        const mine = Boolean(currentUserId && userIds.includes(currentUserId));
        const reactedBy = t("activity:reactions.reactedBy", {
          names: names.format(userIds.map(nameOf)),
          emoji,
        });
        return (
          <Tooltip key={emoji}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-pressed={mine}
                aria-label={`${reactedBy} (${userIds.length})`}
                disabled={!canReact}
                onClick={() => onToggle(emoji, !mine)}
                className={cn(
                  "flex h-6 items-center gap-1 rounded-full border px-2 text-xs tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
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
              <p className="text-xs">{reactedBy}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
      {canReact && (
        <AddReactionButton
          className="rounded-full"
          onSelect={(emoji) => onToggle(emoji, true)}
        />
      )}
    </div>
  );
}
