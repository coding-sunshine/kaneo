import { Link } from "@tanstack/react-router";
import {
  ChevronRight,
  GitPullRequest,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import Layout from "@/components/common/layout";
import PageTitle from "@/components/page-title";
import { FilesTab } from "@/components/reviews/files-tab";
import { CopyReviewLinkButton } from "@/components/reviews/copy-review-link-button";
import { MergeButton } from "@/components/reviews/merge-button";
import { OverviewTab } from "@/components/reviews/overview-tab";
import { PullRequestIssueCrumb } from "@/components/reviews/pull-request-issue-crumb";
import { PullRequestMenu } from "@/components/reviews/pull-request-menu";
import { ReadyForReviewButton } from "@/components/reviews/ready-for-review-button";
import { ReviewDialog } from "@/components/reviews/review-dialog";
import { ReviewsTabPill } from "@/components/reviews/reviews-tab-pill";
import { PullRequestStatusIcon } from "@/components/task/task-pull-requests/pull-request-status-icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { PullRef } from "@/fetchers/github-reviews/github-reviews";
import { usePullRequest } from "@/hooks/queries/github-reviews/use-github-reviews";
import { useUserPreferencesStore } from "@/store/user-preferences";

type Tab = "overview" | "files";

export function PullRequestPage({
  pullRef,
  workspaceId,
}: {
  pullRef: PullRef;
  workspaceId: string;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("overview");
  // ponytail: reviewed files last until the page closes; persisting them is in todo.json.
  const [reviewed, setReviewed] = useState<string[]>([]);
  const expanded = useUserPreferencesStore((state) => state.reviewsExpanded);
  const setExpanded = useUserPreferencesStore(
    (state) => state.setReviewsExpanded,
  );
  const pull = usePullRequest(pullRef);
  const title = pull.data
    ? `${pull.data.title} #${pull.data.number}`
    : t("workspace:reviews.pageTitle");
  const githubLabel = pull.data ? `${pull.data.repo}#${pull.data.number}` : "";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageTitle title={title} />
      {/* Linear's breadcrumb row: Reviews › status, title, number and size. */}
      <Layout.Header className="items-center gap-1.5 text-[13px]">
        {/* Below lg the list is hidden, so this link is the way back. */}
        <Link
          to="/dashboard/workspace/$workspaceId/reviews"
          params={{ workspaceId }}
          className="shrink-0 px-1 text-muted-foreground hover:text-foreground lg:hidden"
        >
          {t("workspace:reviews.pageTitle")}
        </Link>
        {pull.data && (
          <>
            <ChevronRight
              aria-hidden
              className="size-3.5 shrink-0 text-muted-foreground lg:hidden"
            />
            <PullRequestIssueCrumb issue={pull.data.issue} />
            <ChevronRight
              aria-hidden
              className="size-3.5 shrink-0 text-muted-foreground"
            />
            <PullRequestStatusIcon
              status={pull.data.status}
              className="size-4 shrink-0"
            />
            <span className="min-w-0 truncate font-medium">
              {pull.data.title}
            </span>
            <span className="shrink-0 text-muted-foreground tabular-nums">
              #{pull.data.number}
            </span>
            <span className="shrink-0 text-success-foreground tabular-nums">
              +{pull.data.additions}
            </span>
            <span className="shrink-0 text-destructive-foreground tabular-nums">
              -{pull.data.deletions}
            </span>
            <PullRequestMenu pullRef={pullRef} pull={pull.data} />
          </>
        )}
        <span className="flex-1" />
        {pull.data && (
          <Button
            variant="ghost"
            size="xs"
            className="shrink-0 font-mono text-muted-foreground max-sm:hidden"
            render={
              <a
                href={pull.data.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${githubLabel}, ${t("workspace:reviews.detail.openOnGithub")}`}
              />
            }
          >
            <GitPullRequest />
            {githubLabel}
          </Button>
        )}
        {pull.data && <CopyReviewLinkButton />}
        <Button
          variant="ghost"
          size="icon-xs"
          className="shrink-0 max-lg:hidden"
          aria-label={t(
            expanded
              ? "workspace:reviews.detail.collapse"
              : "workspace:reviews.detail.expand",
          )}
          aria-pressed={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <Minimize2 /> : <Maximize2 />}
        </Button>
      </Layout.Header>
      <div className="flex min-h-0 flex-1 flex-col">
        {pull.isLoading ? (
          <Skeleton className="m-4 h-16" />
        ) : pull.isError || !pull.data ? (
          <p role="alert" className="p-6 text-muted-foreground text-sm">
            {t("workspace:reviews.detail.notFound")}
          </p>
        ) : (
          <>
            <div className="flex shrink-0 items-center gap-1.5 px-4 py-2.5">
              <div role="tablist" className="flex items-center gap-1.5">
                <ReviewsTabPill
                  active={tab === "overview"}
                  onClick={() => setTab("overview")}
                >
                  {t("workspace:reviews.detail.tabs.overview")}
                </ReviewsTabPill>
                <ReviewsTabPill
                  active={tab === "files"}
                  onClick={() => setTab("files")}
                >
                  {t("workspace:reviews.detail.tabs.diff")}
                </ReviewsTabPill>
              </div>
              {(pull.data.status === "open" ||
                pull.data.status === "draft") && (
                <span className="ml-auto flex shrink-0 items-center gap-1.5">
                  <ReviewDialog pullRef={pullRef} />
                  {pull.data.status === "draft" ? (
                    <ReadyForReviewButton pullRef={pullRef} />
                  ) : (
                    <MergeButton pullRef={pullRef} pull={pull.data} />
                  )}
                </span>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {tab === "overview" && (
                <OverviewTab
                  pullRef={pullRef}
                  pull={pull.data}
                  workspaceId={workspaceId}
                />
              )}
              {tab === "files" && (
                <FilesTab
                  pullRef={pullRef}
                  reviewed={reviewed}
                  onReviewedChange={(filename, value) =>
                    setReviewed((files) =>
                      value
                        ? [...files, filename]
                        : files.filter((file) => file !== filename),
                    )
                  }
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
