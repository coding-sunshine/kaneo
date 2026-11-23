import { Link } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { IssuePicker } from "@/components/reviews/issue-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type {
  PullRef,
  PullRequestDetail,
} from "@/fetchers/github-reviews/github-reviews";
import { useUnlinkPullRequestIssue } from "@/hooks/queries/github-reviews/use-github-reviews";
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
  const unlink = useUnlinkPullRequestIssue(pullRef);
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="-mx-1.5 inline-flex h-7 items-center gap-2 rounded-full px-2.5 text-muted-foreground hover:bg-accent hover:text-foreground data-popup-open:bg-accent"
        aria-label={t("workspace:reviews.detail.linkIssueLabel")}
      >
        <Plus aria-hidden className="size-3.5" />
        {t("workspace:reviews.detail.linkIssue")}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1">
        <IssuePicker
          pullRef={pullRef}
          pull={pull}
          workspaceId={workspaceId}
          onDone={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
