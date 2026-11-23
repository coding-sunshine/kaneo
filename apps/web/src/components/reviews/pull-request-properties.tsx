import { ListChecks } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AddReviewersPopover } from "@/components/reviews/add-reviewers-popover";
import { ChecksList } from "@/components/reviews/checks-list";
import { Person } from "@/components/reviews/person";
import { PullRequestIssueLink } from "@/components/reviews/pull-request-issue-link";
import { PullRequestProperty } from "@/components/reviews/pull-request-property";
import { PullRequestStatusIcon } from "@/components/task/task-pull-requests/pull-request-status-icon";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type {
  PullRef,
  PullRequestDetail,
} from "@/fetchers/github-reviews/github-reviews";
import { usePullRequestChecks } from "@/hooks/queries/github-reviews/use-github-reviews";
import { cn } from "@/lib/cn";

// Linear's Status, Reviewers and Checks rows. Rows without data are left out,
// as Linear leaves out Checks when none have run.
export function PullRequestProperties({
  pullRef,
  pull,
  workspaceId,
}: {
  pullRef: PullRef;
  pull: PullRequestDetail;
  workspaceId: string;
}) {
  const { t } = useTranslation();
  // Reviewers can only be asked while the pull request is still open.
  const isActive = pull.status === "open" || pull.status === "draft";
  const checks = usePullRequestChecks(pullRef).data;
  const count = (state: string) =>
    checks?.checks.filter((check) => check.state === state).length ?? 0;
  const summary = [
    ["checksFailed", count("failure")],
    ["checksRunning", count("pending")],
    ["checksPassed", count("success")],
  ] as const;

  return (
    <dl className="grid grid-cols-[7.5rem_minmax(0,1fr)] text-sm">
      <PullRequestProperty
        label={t("workspace:reviews.detail.properties.status")}
      >
        <span className="inline-flex items-center gap-2">
          <PullRequestStatusIcon status={pull.status} className="size-4" />
          {t(`workspace:reviews.status.${pull.status}`)}
        </span>
      </PullRequestProperty>
      {(pull.requestedReviewers.length > 0 || isActive) && (
        <PullRequestProperty
          label={t("workspace:reviews.detail.properties.reviewers")}
        >
          {pull.requestedReviewers.map((person) => (
            <Person key={person.login} author={person} />
          ))}
          {isActive && <AddReviewersPopover pullRef={pullRef} pull={pull} />}
        </PullRequestProperty>
      )}
      <PullRequestProperty
        label={t("workspace:reviews.detail.properties.issues")}
      >
        <PullRequestIssueLink
          pullRef={pullRef}
          pull={pull}
          workspaceId={workspaceId}
        />
      </PullRequestProperty>
      {checks && checks.checks.length > 0 && (
        <PullRequestProperty
          label={t("workspace:reviews.detail.properties.checks")}
        >
          <Popover>
            <PopoverTrigger className="-mx-1.5 inline-flex h-7 items-center gap-2 rounded-md px-1.5 hover:bg-accent">
              <ListChecks
                aria-hidden
                className={cn(
                  "size-4",
                  checks.state === "success" && "text-success-foreground",
                  checks.state === "failure" && "text-destructive-foreground",
                  checks.state === "pending" && "text-warning-foreground",
                )}
              />
              {summary
                .filter(([, n]) => n > 0)
                .map(([key, n]) =>
                  t(`workspace:reviews.detail.${key}`, { count: n }),
                )
                .join(", ")}
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-1">
              <ChecksList pullRef={pullRef} />
            </PopoverContent>
          </Popover>
        </PullRequestProperty>
      )}
      {pull.labels.length > 0 && (
        <PullRequestProperty
          label={t("workspace:reviews.detail.properties.labels")}
        >
          <ul className="flex flex-wrap gap-1.5">
            {pull.labels.map((label) => (
              <li
                key={label.name}
                className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs"
              >
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ backgroundColor: `#${label.color}` }}
                />
                {label.name}
              </li>
            ))}
          </ul>
        </PullRequestProperty>
      )}
    </dl>
  );
}
