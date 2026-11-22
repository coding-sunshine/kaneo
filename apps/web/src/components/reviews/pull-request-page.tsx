import { Link } from "@tanstack/react-router";
import { Check, CircleDot, ExternalLink, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import CommentEditor from "@/components/activity/comment-editor";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { PatchDiff } from "@/components/reviews/patch-diff";
import { ReviewForm } from "@/components/reviews/review-form";
import { PullRequestStatusIcon } from "@/components/task/task-pull-requests/pull-request-status-icon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { PullRef } from "@/fetchers/github-reviews/github-reviews";
import {
  usePullRequest,
  usePullRequestChecks,
  usePullRequestConversation,
  usePullRequestFiles,
} from "@/hooks/queries/github-reviews/use-github-reviews";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/format";

type Tab = "overview" | "files" | "checks";

function Person({
  author,
}: {
  author: { login: string; avatarUrl: string } | null;
}) {
  if (!author) return null;
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-foreground text-xs">
      <Avatar className="size-5">
        <AvatarImage src={author.avatarUrl} alt="" />
        <AvatarFallback>{author.login.slice(0, 2)}</AvatarFallback>
      </Avatar>
      {author.login}
    </span>
  );
}

function FilesTab({ pullRef }: { pullRef: PullRef }) {
  const { t } = useTranslation();
  const files = usePullRequestFiles(pullRef, true);
  if (files.isLoading) return <Skeleton className="m-4 h-40" />;
  if (files.isError || !files.data) {
    return (
      <p role="alert" className="p-6 text-muted-foreground text-sm">
        {t("workspace:reviews.loadError")}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3 p-4">
      {files.data.map((file) => (
        <section
          key={file.filename}
          className="overflow-hidden rounded-lg border"
        >
          <h3 className="flex items-center gap-2 border-b bg-muted/40 px-3 py-1.5 font-mono text-xs">
            <span className="min-w-0 flex-1 truncate">{file.filename}</span>
            <span className="text-success-foreground tabular-nums">
              +{file.additions}
            </span>
            <span className="text-destructive-foreground tabular-nums">
              -{file.deletions}
            </span>
          </h3>
          {file.patch ? (
            <PatchDiff patch={file.patch} />
          ) : (
            <p className="p-3 text-muted-foreground text-xs">
              {t("workspace:reviews.detail.noPatch")}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}

function ChecksTab({ pullRef }: { pullRef: PullRef }) {
  const { t } = useTranslation();
  const checks = usePullRequestChecks(pullRef);
  if (checks.isLoading) return <Skeleton className="m-4 h-24" />;
  if (!checks.data?.checks.length) {
    return (
      <p className="p-6 text-muted-foreground text-sm">
        {t("workspace:reviews.detail.noChecks")}
      </p>
    );
  }
  return (
    <ul className="flex flex-col px-4">
      {checks.data.checks.map((check) => (
        <li
          key={`${check.name}-${check.url}`}
          className="flex h-10 items-center gap-2.5 border-border/50 border-b text-sm"
        >
          {check.state === "success" ? (
            <Check className="size-4 text-success-foreground" />
          ) : check.state === "failure" ? (
            <X className="size-4 text-destructive-foreground" />
          ) : (
            <CircleDot className="size-4 text-warning-foreground" />
          )}
          <span className="min-w-0 flex-1 truncate">{check.name}</span>
          {check.url && (
            <a
              href={check.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground text-xs hover:text-foreground"
            >
              {t("workspace:reviews.detail.details")}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

// The same read-only ProseMirror renderer issue comments use; it builds nodes
// from markdown rather than injecting GitHub's text as HTML.
function Markdown({ value }: { value: string }) {
  return (
    <CommentEditor
      value={value}
      readOnly
      className="kaneo-comment-viewer [&_.kaneo-comment-editor-content_.ProseMirror]:p-0"
    />
  );
}

function OverviewTab({ pullRef, body }: { pullRef: PullRef; body: string }) {
  const { t } = useTranslation();
  const conversation = usePullRequestConversation(pullRef);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      {body ? (
        <Markdown value={body} />
      ) : (
        <p className="text-muted-foreground text-sm">
          {t("workspace:reviews.detail.noDescription")}
        </p>
      )}
      {conversation.data?.map((entry) => (
        <article key={entry.id} className="rounded-lg border p-3">
          <header className="mb-1.5 flex items-center gap-2 text-muted-foreground text-xs">
            <Person author={entry.author} />
            {entry.reviewState && (
              <span className="uppercase tracking-wide">
                {entry.reviewState.replace("_", " ").toLowerCase()}
              </span>
            )}
            <span>
              {formatRelativeTime(
                entry.createdAt,
                undefined,
                undefined,
                "short",
              )}
            </span>
          </header>
          {entry.body && <Markdown value={entry.body} />}
        </article>
      ))}
      <ReviewForm pullRef={pullRef} />
    </div>
  );
}

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
                  {(["overview", "files", "checks"] as const).map((id) => (
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
                  <OverviewTab pullRef={pullRef} body={pull.data.body} />
                )}
                {tab === "files" && <FilesTab pullRef={pullRef} />}
                {tab === "checks" && <ChecksTab pullRef={pullRef} />}
              </div>
            </>
          )}
        </div>
      </WorkspaceLayout>
    </>
  );
}
