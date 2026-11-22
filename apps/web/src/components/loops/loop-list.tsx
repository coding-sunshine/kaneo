import { Workflow } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LoopDraft } from "@/components/loops/loop-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { getLoops } from "@/fetchers/loop/loops";
import { useLoopMutations } from "@/hooks/mutations/loop/use-loop-mutations";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";

type Loop = Awaited<ReturnType<typeof getLoops>>[number];

type LoopListProps = {
  workspaceId: string;
  loops: Loop[];
  currentUserId: string | undefined;
  onEdit: (draft: LoopDraft) => void;
  onOpenRuns: (loop: Loop) => void;
};

/** One row per loop; right-click for run now, enable/disable, edit, delete. */
export function LoopList({
  workspaceId,
  loops,
  currentUserId,
  onEdit,
  onOpenRuns,
}: LoopListProps) {
  const { t } = useTranslation();
  const { update, remove, run } = useLoopMutations(workspaceId);
  const fail = (error: Error) => toast.error(error.message);

  return (
    <ul className="flex flex-col">
      {loops.map((loop) => {
        const own = loop.creatorId === currentUserId;
        return (
          <ContextMenu key={loop.id}>
            <ContextMenuTrigger render={<li />}>
              <button
                type="button"
                onClick={() => onOpenRuns(loop)}
                className="flex h-11 w-full items-center gap-3 border-border/60 border-b px-4 text-left text-[13px] hover:bg-accent/50"
              >
                <Workflow className="size-4 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {loop.name}
                </span>
                {loop.enabled ? null : (
                  <span className="text-muted-foreground text-xs">
                    {t("navigation:loops.paused")}
                  </span>
                )}
                <span className="text-muted-foreground">
                  {loop.frequency
                    ? t(`navigation:loops.frequency.${loop.frequency}`)
                    : t(`navigation:loops.event.${loop.trigger}`)}
                </span>
                <span className="hidden w-40 text-right text-muted-foreground sm:block">
                  {loop.enabled && loop.nextRunAt
                    ? t("navigation:loops.nextRun", {
                        date: formatDate(loop.nextRunAt, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }),
                      })
                    : null}
                </span>
                <span className="hidden w-32 truncate text-right text-muted-foreground md:block">
                  {loop.creatorName}
                </span>
              </button>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-52">
              {own ? (
                <>
                  <ContextMenuItem
                    onClick={() =>
                      run.mutate(loop.id, {
                        onSuccess: () =>
                          toast.success(t("navigation:loops.ran")),
                        onError: fail,
                      })
                    }
                  >
                    {t("navigation:loops.runNow")}
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() =>
                      update.mutate(
                        { id: loop.id, enabled: !loop.enabled },
                        { onError: fail },
                      )
                    }
                  >
                    {t(
                      loop.enabled
                        ? "navigation:loops.disable"
                        : "navigation:loops.enable",
                    )}
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => onEdit(loop)}>
                    {t("navigation:loops.edit")}
                  </ContextMenuItem>
                </>
              ) : null}
              <ContextMenuItem onClick={() => onOpenRuns(loop)}>
                {t("navigation:loops.history")}
              </ContextMenuItem>
              {own ? (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    variant="destructive"
                    onClick={() =>
                      remove.mutate(loop.id, {
                        onSuccess: () =>
                          toast.success(t("navigation:loops.deleted")),
                        onError: fail,
                      })
                    }
                  >
                    {t("navigation:loops.delete")}
                  </ContextMenuItem>
                </>
              ) : null}
            </ContextMenuContent>
          </ContextMenu>
        );
      })}
    </ul>
  );
}
