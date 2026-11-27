import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useSummarizeTask } from "@/hooks/mutations/agent/use-summarize-task";
import { useHasAgent } from "@/hooks/queries/agent/use-agent";
import { TaskSummaryCard } from "./task-summary-card";

/** "Summarise" on a ticket: asks for a summary and shows it; changes nothing. */
export function TaskSummary({
  workspaceId,
  taskId,
}: {
  workspaceId: string;
  taskId: string;
}) {
  const { t } = useTranslation();
  const hasAgent = useHasAgent();
  const summarize = useSummarizeTask(workspaceId, taskId);
  if (!hasAgent) return null;
  return (
    <section
      aria-label={t("tasks:summary.title")}
      className="flex flex-col gap-2"
    >
      <div>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          disabled={summarize.isPending}
          onClick={() => summarize.mutate()}
        >
          <Sparkles />
          {summarize.isPending
            ? t("tasks:summary.working")
            : summarize.data
              ? t("tasks:summary.again")
              : t("tasks:summary.action")}
        </Button>
      </div>
      {summarize.isError ? (
        <p role="alert" className="text-destructive text-sm">
          {summarize.error.message}
        </p>
      ) : null}
      {summarize.data ? (
        <TaskSummaryCard workspaceId={workspaceId} summary={summarize.data} />
      ) : null}
    </section>
  );
}
