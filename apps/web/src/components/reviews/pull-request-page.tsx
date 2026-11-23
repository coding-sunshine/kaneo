import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { FilesTab } from "@/components/reviews/files-tab";
import { MergeButton } from "@/components/reviews/merge-button";
import { OverviewTab } from "@/components/reviews/overview-tab";
import { Person } from "@/components/reviews/person";
import { ReviewDialog } from "@/components/reviews/review-dialog";
import { PullRequestStatusIcon } from "@/components/task/task-pull-requests/pull-request-status-icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { PullRef } from "@/fetchers/github-reviews/github-reviews";
import { usePullRequest } from "@/hooks/queries/github-reviews/use-github-reviews";
import { cn } from "@/lib/cn";

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
  const pull = usePullRequest(pullRef);
  const title = pull.data
    ? `${pull.data.title} #${pull.data.number}`
    : t("workspace:reviews.pageTitle");

  return (
    <>
      <PageTitle title={title} />
      <WorkspaceLayout
        title={t("workspace:reviews.pageTitle")}
        crumbs={
          <Link
            to="/dashboard/workspace/$workspaceId/reviews"
            params={{ workspaceId }}
            className="text-card-foreground text-xs"
          >
            {t("workspace:reviews.pageTitle")}
          </Link>
        }
        headerActions={
          pull.data && (
            <Button
              variant="ghost"
              size="xs"
              render={
                <a
                  href={pull.data.url}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <ExternalLink />
              {t("workspace:reviews.detail.openOnGithub")}
            </Button>
          )
        }
      >
        <div className="flex h-full min-h-0 flex-col">
          {pull.isLoading ? (
            <Skeleton className="m-4 h-16" />
          ) : pull.isError || !pull.data ? (
            <p role="alert" className="p-6 text-muted-foreground text-sm">
              {t("workspace:reviews.detail.notFound")}
            </p>
          ) : (
            <>
              <div className="flex shrink-0 flex-col gap-2 border-border/50 border-b px-4 py-3">
                <h1 className="flex items-center gap-2 font-semibold text-base">
                  <PullRequestStatusIcon
                    status={pull.data.status}
                    className="size-4"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {pull.data.title}
                  </span>
                  <span className="font-normal text-muted-foreground">
                    #{pull.data.number}
                  </span>
                  {(pull.data.status === "open" ||
                    pull.data.status === "draft") && (
                    <span className="ml-2 flex shrink-0 items-center gap-1.5">
                      <ReviewDialog pullRef={pullRef} />
                      <MergeButton pullRef={pullRef} pull={pull.data} />
                    </span>
                  )}
                </h1>
                <p className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
                  <Person author={pull.data.author} />
                  <span>
                    {pull.data.owner}/{pull.data.repo}
                  </span>
                  <span className="font-mono">
                    {pull.data.baseRef} ← {pull.data.headRef}
                  </span>
                  <span className="text-success-foreground">
                    +{pull.data.additions}
                  </span>
                  <span className="text-destructive-foreground">
                    -{pull.data.deletions}
                  </span>
                </p>
                <div
                  role="tablist"
                  className="inline-flex items-center gap-1.5"
                >
                  {(["overview", "files"] as const).map((id) => (
                    <Button
                      key={id}
                      role="tab"
                      aria-selected={tab === id}
                      variant="outline"
                      size="xs"
                      onClick={() => setTab(id)}
                      className={cn(
                        "rounded-full",
                        tab === id
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {t(`workspace:reviews.detail.tabs.${id}`)}
                      {id === "files" && ` ${pull.data.changedFiles}`}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {tab === "overview" && (
                  <OverviewTab pullRef={pullRef} pull={pull.data} />
                )}
                {tab === "files" && <FilesTab pullRef={pullRef} />}
              </div>
            </>
          )}
        </div>
      </WorkspaceLayout>
    </>
  );
}
