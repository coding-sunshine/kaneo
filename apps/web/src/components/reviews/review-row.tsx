import { Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ReviewRowLabels } from "@/components/reviews/review-row-labels";
import type { PullRequestAction } from "@/components/reviews/pull-request-action-dialog";
import { ReviewRowMenu } from "@/components/reviews/review-row-menu";
import { ReviewRowQuick } from "@/components/reviews/review-row-quick";
import { ReviewRowReviewers } from "@/components/reviews/review-row-reviewers";
import { ReviewRowRisk } from "@/components/reviews/review-row-risk";
import { ReviewRowSla } from "@/components/reviews/review-row-sla";
import { PullRequestStatusIcon } from "@/components/task/task-pull-requests/pull-request-status-icon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import {
  reviewDate,
  type ReviewItem,
  type ReviewsProperty,
} from "@/lib/reviews-view";
import { cn } from "@/lib/cn";
import { rowContext, statusDetailsKey } from "@/lib/review-row-details";
import { formatDate } from "@/lib/format";
import { isSnoozed } from "@/lib/reviews-snooze";
import { shortAge } from "@/lib/short-age";
import { useReviewsSnoozeStore } from "@/store/reviews-snooze";

export const reviewRowKey = (pr: ReviewItem) =>
  `${pr.owner}/${pr.repo}#${pr.number}`;

export const reviewDetailRoute =
  "/dashboard/workspace/$workspaceId/reviews/$owner/$repo/$number" as const;

export const reviewDetailParams = (pr: ReviewItem, workspaceId: string) => ({
  workspaceId,
  owner: pr.owner,
  repo: pr.repo,
  number: String(pr.number),
});

export function ReviewRow({
  pr,
  workspaceId,
  properties,
  selected,
  onFocus,
  onAction,
  me,
}: {
  pr: ReviewItem;
  workspaceId: string;
  properties: ReviewsProperty[];
  selected: boolean;
  onFocus: () => void;
  onAction: (pr: ReviewItem, action: PullRequestAction) => void;
  /** Viewer's GitHub login, from the page. Null when Reviews has none. */
  me: string | null;
}) {
  const { t } = useTranslation();
  const show = (property: ReviewsProperty) => properties.includes(property);
  const detailsKey = show("statusDetails") ? statusDetailsKey(pr) : null;
  const details = show("statusDetails")
    ? detailsKey
      ? t(`workspace:reviews.statusDetails.${detailsKey}`)
      : pr.reviewDecision &&
        t(`workspace:reviews.reviewStatus.${pr.reviewDecision}`)
    : null;
  const context = rowContext(pr, properties);
  const entry = useReviewsSnoozeStore(
    (state) => state.entries[reviewRowKey(pr)],
  );
  const snoozed = isSnoozed(entry, pr);
  const snoozeTip = !entry
    ? ""
    : entry.until
      ? t("workspace:reviews.snooze.snoozed", {
          date: formatDate(new Date(entry.until), {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }),
        })
      : t(
          entry.mode === "newComment"
            ? "workspace:reviews.snooze.tipComment"
            : "workspace:reviews.snooze.tipReview",
        );
  const link = (
    <Link
      to={reviewDetailRoute}
      params={reviewDetailParams(pr, workspaceId)}
      data-review-row={reviewRowKey(pr)}
      aria-current={selected ? "page" : undefined}
      onFocus={onFocus}
      className={cn(
        "mx-2 flex min-h-12 flex-col justify-center rounded-md px-2.5 py-1.5 text-[13px] outline-none transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 aria-[current=page]:bg-accent",
      )}
    >
      <span className="flex items-center gap-2.5">
        <PullRequestStatusIcon status={pr.status} className="size-4" />
        <span className="min-w-0 flex-1 truncate text-foreground">
          {pr.title}
        </span>
        {show("quickToReview") && <ReviewRowQuick pr={pr} me={me} />}
        {show("risk") && <ReviewRowRisk level={pr.riskLevel} />}
        {show("sla") && <ReviewRowSla issue={pr.issue} />}
        {show("labels") && <ReviewRowLabels labels={pr.labels} />}
        {show("githubTeam") && pr.teamReviewers.length > 0 && (
          <span
            title={pr.teamReviewers.join(", ")}
            className="max-w-24 shrink-0 truncate text-muted-foreground text-xs"
          >
            {pr.teamReviewers[0]}
            {pr.teamReviewers.length > 1 && ` +${pr.teamReviewers.length - 1}`}
          </span>
        )}
        {show("reviewers") && <ReviewRowReviewers reviewers={pr.reviewers} />}
        {show("author") && pr.author && (
          <Avatar className="size-4.5" title={pr.author.login}>
            <AvatarImage src={pr.author.avatarUrl} alt={pr.author.login} />
            <AvatarFallback>{pr.author.login.slice(0, 2)}</AvatarFallback>
          </Avatar>
        )}
        {snoozed && (
          <Clock
            aria-label={snoozeTip}
            className="size-3.5 shrink-0 text-indigo-500"
          >
            <title>{snoozeTip}</title>
          </Clock>
        )}
        {show("date") && (
          <span className="w-8 shrink-0 text-right text-muted-foreground tabular-nums">
            {shortAge(reviewDate(pr))}
          </span>
        )}
      </span>
      <span className="truncate pl-6.5 text-muted-foreground text-xs">
        {[details, context].filter(Boolean).join(" · ")}
      </span>
    </Link>
  );
  return (
    <ContextMenu>
      <ContextMenuTrigger render={link} />
      <ReviewRowMenu
        pr={pr}
        workspaceId={workspaceId}
        onAction={(action) => onAction(pr, action)}
      />
    </ContextMenu>
  );
}
