import { Link } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type {
  PullRef,
  PullRequestDetail,
} from "@/fetchers/github-reviews/github-reviews";
import {
  useLinkPullRequestIssue,
  useUnlinkPullRequestIssue,
} from "@/hooks/queries/github-reviews/use-github-reviews";
import useGlobalSearch from "@/hooks/queries/search/use-global-search";
import { toast } from "@/lib/toast";

/** Linear's Issues row: the linked Kaneo task, or a picker to link one. */
export function PullRequestIssueLink({
  pullRef,
  pull,
  workspaceId,
}: {
  pullRef: PullRef;
  pull: PullRequestDetail;
  workspaceId: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const link = useLinkPullRequestIssue(pullRef);
  const unlink = useUnlinkPullRequestIssue(pullRef);
  const search = useGlobalSearch({
    q: query.trim(),
    type: "tasks",
    workspaceId,
    limit: 8,
  });
  const tasks = (search.data?.results ?? []).filter(
    (result) => result.type === "task" && !result.archivedAt,
  );
  const onError = (error: Error) => toast.error(error.message);

  if (pull.issue) {
    const { issue } = pull;
    return (
      <span className="inline-flex items-center gap-1">
        <Link
          to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
          params={{
            workspaceId: issue.workspaceId,
            projectId: issue.team.id,
            taskId: issue.taskId,
          }}
          className="max-w-96 truncate rounded-full border px-2 py-0.5 text-xs hover:bg-accent"
        >
          {issue.title}
        </Link>
        {issue.manual && (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("workspace:reviews.detail.unlinkIssue")}
            disabled={unlink.isPending}
            onClick={() =>
              unlink.mutate(
                { taskId: issue.taskId, id: issue.linkId },
                { onError },
              )
            }
          >
            <X />
          </Button>
        )}
      </span>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger
        className="-mx-1.5 inline-flex h-7 items-center gap-2 rounded-full px-2.5 text-muted-foreground hover:bg-accent hover:text-foreground data-popup-open:bg-accent"
        aria-label={t("workspace:reviews.detail.linkIssueLabel")}
      >
        <Plus aria-hidden className="size-3.5" />
        {t("workspace:reviews.detail.linkIssue")}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1">
        <Input
          size="sm"
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("workspace:reviews.detail.searchIssues")}
          aria-label={t("workspace:reviews.detail.searchIssues")}
        />
        <ul className="mt-1 flex flex-col">
          {tasks.map((task) => (
            <li key={task.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-60"
                disabled={link.isPending}
                onClick={() =>
                  link.mutate(
                    { taskId: task.id, url: pull.url, status: pull.status },
                    { onSuccess: () => setOpen(false), onError },
                  )
                }
              >
                <span className="truncate">{task.title}</span>
              </button>
            </li>
          ))}
        </ul>
        {query.trim() !== "" && !search.isFetching && tasks.length === 0 && (
          <p className="px-2 py-1.5 text-muted-foreground text-sm">
            {t("workspace:reviews.detail.noIssuesFound")}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
