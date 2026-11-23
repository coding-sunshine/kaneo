import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/cn";
import type { ReviewsGroup } from "@/lib/reviews-view";

/**
 * Linear's inset group bar. Top-level bars collapse their rows and can be
 * pinned below the other groups; sub-group bars only label.
 */
export function ReviewGroupHeader({
  group,
  level,
  collapsed = false,
  pinned = false,
  onToggleCollapsed,
  onTogglePin,
}: {
  group: ReviewsGroup;
  level: 0 | 1;
  collapsed?: boolean;
  pinned?: boolean;
  onToggleCollapsed?: () => void;
  onTogglePin?: () => void;
}) {
  const { t } = useTranslation();
  const label =
    group.by === "author" || group.by === "repository"
      ? group.key || t("workspace:reviews.noAuthor")
      : t(`workspace:reviews.${group.by}.${group.key}`);
  const content = (
    <>
      <span className="truncate">{label}</span>
      <span className="text-muted-foreground tabular-nums">
        {group.items.length}
      </span>
    </>
  );
  if (level === 1) {
    return (
      <h3 className="mx-2 mt-1 flex h-7 items-center gap-1.5 px-5 text-[13px] text-muted-foreground">
        {content}
      </h3>
    );
  }
  const Chevron = collapsed ? ChevronRight : ChevronDown;
  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <h2 className="mx-2 mt-1 first:mt-0">
            <button
              type="button"
              aria-expanded={!collapsed}
              onClick={onToggleCollapsed}
              className={cn(
                "flex h-7 w-full items-center gap-1.5 rounded-md bg-muted px-2.5 text-left font-normal text-[13px] text-foreground/80 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              {content}
              <Chevron
                aria-hidden
                className="size-3 shrink-0 text-muted-foreground"
              />
            </button>
          </h2>
        }
      />
      <ContextMenuContent>
        <ContextMenuItem onClick={onTogglePin}>
          {pinned
            ? t("workspace:reviews.unpinGroup")
            : t("workspace:reviews.pinGroup")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
