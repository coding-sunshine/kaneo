import { GitPullRequest } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CodingAgentRun } from "@/fetchers/agent/delegation";

const STATUS_KEYS = {
  starting: "tasks:delegation.status.starting",
  running: "tasks:delegation.status.running",
  pr_opened: "tasks:delegation.status.prOpened",
  merged: "tasks:delegation.status.merged",
  failed: "tasks:delegation.status.failed",
} as const;

/** One coding agent run: who works on it, how far it got, its pull request. */
export function TaskDelegationRun({ run }: { run: CodingAgentRun }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="font-medium">{run.agent}</span>
      <span
        className={
          run.status === "failed" ? "text-destructive" : "text-muted-foreground"
        }
      >
        {t(STATUS_KEYS[run.status])}
      </span>
      {run.pullRequestUrl ? (
        <a
          href={run.pullRequestUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
        >
          <GitPullRequest className="size-3" aria-hidden="true" />
          {t("tasks:delegation.pullRequest")}
        </a>
      ) : null}
    </div>
  );
}
