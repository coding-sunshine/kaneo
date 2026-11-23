import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChecksIcon } from "@/components/reviews/checks-icon";
import { PullRequestStatusIcon } from "@/components/task/task-pull-requests/pull-request-status-icon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  reviewDate,
  type ReviewItem,
  type ReviewsProperty,
} from "@/lib/reviews-view";
import { shortAge } from "@/lib/short-age";

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
}: {
  pr: ReviewItem;
  workspaceId: string;
  properties: ReviewsProperty[];
  selected: boolean;
  onFocus: () => void;
}) {
  const { t } = useTranslation();
  const show = (property: ReviewsProperty) => properties.includes(property);
  return (
    <Link
      to={reviewDetailRoute}
      params={reviewDetailParams(pr, workspaceId)}
      data-review-row={reviewRowKey(pr)}
      aria-current={selected ? "page" : undefined}
      onFocus={onFocus}
      className="mx-2 flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] outline-none transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 aria-[current=page]:bg-accent"
    >
      <PullRequestStatusIcon status={pr.status} className="size-4" />
      <span className="min-w-0 flex-1 truncate text-foreground">
        {pr.title}
      </span>
      {show("repository") && (
        <span className="max-w-32 shrink-0 truncate text-muted-foreground text-xs">
          {pr.repo}
        </span>
      )}
      {show("id") && (
        <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
          #{pr.number}
        </span>
      )}
      {show("statusDetails") && (
        <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground text-xs">
          <ChecksIcon state={pr.checks} />
          {pr.reviewDecision &&
            t(`workspace:reviews.reviewStatus.${pr.reviewDecision}`)}
        </span>
      )}
      {show("author") && pr.author && (
        <Avatar className="size-4.5" title={pr.author.login}>
          <AvatarImage src={pr.author.avatarUrl} alt={pr.author.login} />
          <AvatarFallback>{pr.author.login.slice(0, 2)}</AvatarFallback>
        </Avatar>
      )}
      {show("date") && (
        <span className="w-8 shrink-0 text-right text-muted-foreground tabular-nums">
          {shortAge(reviewDate(pr))}
        </span>
      )}
    </Link>
  );
}
