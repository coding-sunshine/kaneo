import { useTranslation } from "react-i18next";
import { AgentSourceChip } from "@/components/agent/agent-source-chip";
import type { TaskSummary } from "@/fetchers/agent/task-summary";

/** The current state and blockers of a ticket, with the comments they rest on. */
export function TaskSummaryCard({
  workspaceId,
  summary,
}: {
  workspaceId: string;
  summary: TaskSummary;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/70 bg-muted/20 px-3 py-2.5 text-sm">
      <p className="whitespace-pre-wrap">{summary.currentState}</p>
      <div>
        <h3 className="font-medium text-muted-foreground text-xs">
          {t("tasks:summary.blockers")}
        </h3>
        {summary.blockers.length > 0 ? (
          <ul className="mt-1 list-disc pl-5">
            {summary.blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-muted-foreground">
            {t("tasks:summary.noBlockers")}
          </p>
        )}
      </div>
      {summary.sources.length > 0 ? (
        <div>
          <h3 className="font-medium text-muted-foreground text-xs">
            {t("tasks:summary.sources")}
          </h3>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {summary.sources.map((citation, index) => (
              <li
                key={
                  citation.restricted
                    ? `restricted-${index}`
                    : `${citation.kind}-${citation.id}`
                }
              >
                <AgentSourceChip
                  workspaceId={workspaceId}
                  citation={citation}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
