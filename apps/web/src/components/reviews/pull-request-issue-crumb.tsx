import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { PullRequestDetail } from "@/fetchers/github-reviews/github-reviews";

/** First breadcrumb: the linked Kaneo issue, or "No issue" like Linear. */
export function PullRequestIssueCrumb({
  issue,
}: {
  issue: PullRequestDetail["issue"];
}) {
  const { t } = useTranslation();
  if (!issue)
    return (
      <span className="shrink-0 px-1 text-muted-foreground">
        {t("workspace:reviews.detail.noIssue")}
      </span>
    );
  return (
    <Link
      to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
      params={{
        workspaceId: issue.workspaceId,
        projectId: issue.team.id,
        taskId: issue.taskId,
      }}
      className="max-w-48 shrink-0 truncate px-1 text-muted-foreground hover:text-foreground"
    >
      {issue.title}
    </Link>
  );
}
