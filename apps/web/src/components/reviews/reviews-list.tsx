import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PullRequestStatusIcon } from "@/components/task/task-pull-requests/pull-request-status-icon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ReviewPullRequest } from "@/fetchers/github-reviews/github-reviews";
import { formatRelativeTime } from "@/lib/format";

const STATUS_ORDER = ["open", "draft", "merged", "closed"] as const;

function ReviewRow({
  pr,
  workspaceId,
}: {
  pr: ReviewPullRequest;
  workspaceId: string;
}) {
  return (
    <Link
      to="/dashboard/workspace/$workspaceId/reviews/$owner/$repo/$number"
      params={{
        workspaceId,
        owner: pr.owner,
        repo: pr.repo,
        number: String(pr.number),
      }}
      className="flex h-10 items-center gap-2.5 border-border/50 border-b px-1 outline-none transition-colors hover:bg-accent/50 focus-visible:bg-accent/50"
    >
      <PullRequestStatusIcon status={pr.status} className="size-3.5" />
      <span className="hidden w-48 shrink-0 truncate text-muted-foreground text-xs sm:block">
        {pr.owner}/{pr.repo} #{pr.number}
      </span>
      <span className="min-w-0 flex-1 truncate text-foreground text-sm">
        {pr.title}
      </span>
      {pr.author && (
        <Avatar className="size-5" title={pr.author.login}>
          <AvatarImage src={pr.author.avatarUrl} alt={pr.author.login} />
          <AvatarFallback>{pr.author.login.slice(0, 2)}</AvatarFallback>
        </Avatar>
      )}
      <span className="hidden w-24 shrink-0 text-right text-muted-foreground text-xs sm:block">
        {formatRelativeTime(pr.updatedAt, undefined, undefined, "short")}
      </span>
    </Link>
  );
}

export function ReviewsList({
  pullRequests,
  workspaceId,
}: {
  pullRequests: ReviewPullRequest[];
  workspaceId: string;
}) {
  const { t } = useTranslation();
  const groups = useMemo(
    () =>
      STATUS_ORDER.map((status) => ({
        status,
        items: pullRequests.filter((pr) => pr.status === status),
      })).filter((group) => group.items.length > 0),
    [pullRequests],
  );

  return (
    <div className="flex flex-col">
      {groups.map((group) => (
        <section key={group.status}>
          <h2 className="flex h-9 items-center gap-2 border-border/50 border-b bg-muted/40 px-5 text-[13px]">
            <PullRequestStatusIcon status={group.status} className="size-3.5" />
            <span className="font-semibold text-foreground">
              {t(`workspace:reviews.status.${group.status}`)}
            </span>
            <span className="font-normal text-muted-foreground text-xs tabular-nums">
              {group.items.length}
            </span>
          </h2>
          <div className="flex flex-col px-4">
            {group.items.map((pr) => (
              <ReviewRow
                key={`${pr.owner}/${pr.repo}#${pr.number}`}
                pr={pr}
                workspaceId={workspaceId}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
