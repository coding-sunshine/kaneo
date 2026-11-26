import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { NeedsReviewItem } from "@/fetchers/topic/facts";
import { useClearNeedsReview } from "@/hooks/mutations/topic/use-fact-mutations";
import { formatDateMedium } from "@/lib/format";
import { toast } from "@/lib/toast";
import { FactNow } from "./fact-now";

const linkClass = "outline-none hover:underline focus-visible:underline";

/** One piece of work that rests on a replaced value, with what changed. */
export function NeedsReviewRow({
  workspaceId,
  item,
}: {
  workspaceId: string;
  item: NeedsReviewItem;
}) {
  const { t } = useTranslation();
  const clear = useClearNeedsReview(workspaceId);
  const { task, document, cause } = item;
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-border/60 border-b px-4 py-2 text-[13px]">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {task ? (
          <Link
            to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
            params={{ workspaceId, projectId: task.projectId, taskId: task.id }}
            className={`flex min-w-0 items-center gap-2 ${linkClass}`}
          >
            <span className="shrink-0 font-medium">
              {`${task.projectSlug.toUpperCase()}-${task.number}`}
            </span>
            <span className="min-w-0 truncate font-medium">{task.title}</span>
          </Link>
        ) : (
          document && (
            <Link
              to="/dashboard/workspace/$workspaceId/document/$documentId"
              params={{ workspaceId, documentId: document.id }}
              className={`min-w-0 truncate font-medium ${linkClass}`}
            >
              {document.title || t("navigation:documents.untitled")}
            </Link>
          )
        )}
        <p className="text-muted-foreground text-xs">
          {t("navigation:documents.facts.needsReview.was", {
            name: item.dependsOn.slotName,
            value: item.dependsOn.value,
          })}
        </p>
        {cause ? (
          <FactNow workspaceId={workspaceId} cause={cause} />
        ) : (
          <p className="text-muted-foreground text-xs">
            {t("navigation:documents.facts.needsReview.causeHidden")}
          </p>
        )}
        <p className="text-muted-foreground text-xs">
          {t("navigation:documents.facts.needsReview.replaced", {
            date: formatDateMedium(item.flaggedAt),
          })}
        </p>
      </div>
      <Button
        size="xs"
        variant="outline"
        className="shrink-0"
        disabled={clear.isPending}
        onClick={() =>
          clear.mutate(
            { workspaceId, dependencyId: item.id },
            {
              onSuccess: () =>
                toast.success(t("navigation:documents.facts.relies.clearDone")),
              onError: (error) => toast.error(error.message),
            },
          )
        }
      >
        {t("navigation:documents.facts.relies.clear")}
      </Button>
    </li>
  );
}
