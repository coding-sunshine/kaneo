import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CopyCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import useDeclineDuplicateSuggestion from "@/hooks/mutations/duplicate-suggestion/use-decline-duplicate-suggestion";
import useCreateTaskRelation from "@/hooks/mutations/task-relation/use-create-task-relation";
import useDuplicateSuggestions from "@/hooks/queries/duplicate-suggestion/use-duplicate-suggestions";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";

type DuplicateSuggestionBannerProps = { taskId: string; workspaceId: string };

// A proposal only: nothing changes until someone accepts or declines it.
export function DuplicateSuggestionBanner({
  taskId,
  workspaceId,
}: DuplicateSuggestionBannerProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { canUpdateTasks } = useWorkspacePermission();
  const { data } = useDuplicateSuggestions(taskId);
  const accept = useCreateTaskRelation();
  const decline = useDeclineDuplicateSuggestion();
  const suggestions = data?.suggestions ?? [];
  if (suggestions.length === 0) return null;
  const busy = accept.isPending || decline.isPending;

  const onAccept = (otherTaskId: string) =>
    accept.mutate(
      {
        sourceTaskId: taskId,
        targetTaskId: otherTaskId,
        relationType: "duplicate",
      },
      {
        onSuccess: () => {
          toast.success(t("tasks:duplicateSuggestion.accepted"));
          void queryClient.invalidateQueries({
            queryKey: ["duplicate-suggestions", taskId],
          });
        },
        onError: () => toast.error(t("tasks:duplicateSuggestion.failed")),
      },
    );
  const onDecline = (otherTaskId: string) =>
    decline.mutate(
      { taskId, otherTaskId },
      { onError: () => toast.error(t("tasks:duplicateSuggestion.failed")) },
    );

  return (
    <section
      aria-label={t("tasks:duplicateSuggestion.title")}
      className="flex flex-col gap-2 rounded-md border border-border bg-muted/50 px-3 py-2.5 text-[13px]"
    >
      <p className="flex items-center gap-2 text-muted-foreground">
        <CopyCheck className="size-4 shrink-0" />
        {t("tasks:duplicateSuggestion.title")}
      </p>
      <ul className="flex flex-col gap-1.5">
        {suggestions.map((suggestion) => (
          <li key={suggestion.id} className="flex items-center gap-2">
            <Link
              to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
              params={{
                workspaceId,
                projectId: suggestion.projectId,
                taskId: suggestion.id,
              }}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="shrink-0 font-mono text-muted-foreground">
                {suggestion.ticket}
              </span>
              <span className="truncate text-foreground">
                {suggestion.title}
              </span>
            </Link>
            {canUpdateTasks() && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => onAccept(suggestion.id)}
                >
                  {t("tasks:duplicateSuggestion.accept")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => onDecline(suggestion.id)}
                >
                  {t("tasks:duplicateSuggestion.decline")}
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
