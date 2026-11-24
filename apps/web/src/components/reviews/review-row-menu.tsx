import {
  ExternalLink,
  GitMerge,
  GitPullRequestClosed,
  GitPullRequestDraft,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PullRequestAction } from "@/components/reviews/pull-request-action-dialog";
import { PullRequestChecksSubmenu } from "@/components/reviews/pull-request-checks-submenu";
import { PullRequestCopySubmenu } from "@/components/reviews/pull-request-copy-submenu";
import { PullRequestFavoriteItem } from "@/components/reviews/pull-request-favorite-item";
import { PullRequestOwnerSubmenu } from "@/components/reviews/pull-request-owner-submenu";
import { PullRequestLabelsSubmenu } from "@/components/reviews/pull-request-labels-submenu";
import { PullRequestReviewersSubmenu } from "@/components/reviews/pull-request-reviewers-submenu";
import { PullRequestSnoozeSubmenu } from "@/components/reviews/pull-request-snooze-submenu";
import { ContextMenuContent } from "@/components/ui/context-menu";
import { MenuItem, MenuSeparator } from "@/components/ui/menu";
import type { ReviewPullRequest } from "@/fetchers/github-reviews/github-reviews";
import { requestedReviewers, rowActions } from "@/lib/review-row-actions";

/** Linear's row context menu; GitHub writes only show where the state allows them. */
export function ReviewRowMenu({
  pr,
  workspaceId,
  onAction,
}: {
  pr: ReviewPullRequest;
  workspaceId: string;
  onAction: (action: PullRequestAction) => void;
}) {
  const { t } = useTranslation();
  const pullRef = { owner: pr.owner, repo: pr.repo, number: String(pr.number) };
  const actions = rowActions(pr);
  const writes = actions.convertToDraft || actions.squash || actions.close;
  return (
    <ContextMenuContent className="min-w-56">
      <MenuItem
        render={<a href={pr.url} target="_blank" rel="noopener noreferrer" />}
      >
        <ExternalLink />
        {t("workspace:reviews.detail.openOnGithub")}
      </MenuItem>
      <PullRequestFavoriteItem pullRef={pullRef} workspaceId={workspaceId} />
      <PullRequestSnoozeSubmenu pull={pr} />
      <MenuSeparator />
      <PullRequestCopySubmenu pull={pr} workspaceId={workspaceId} />
      <MenuSeparator />
      <PullRequestChecksSubmenu pullRef={pullRef} />
      <PullRequestOwnerSubmenu
        pullRef={pullRef}
        workspaceId={workspaceId}
        pull={pr}
      />
      {actions.edit && (
        <PullRequestLabelsSubmenu pullRef={pullRef} labels={pr.labels} />
      )}
      {writes && <MenuSeparator />}
      {actions.convertToDraft && (
        <MenuItem onClick={() => onAction("draft")}>
          <GitPullRequestDraft />
          {t("workspace:reviews.prActions.convertToDraft")}
        </MenuItem>
      )}
      {actions.squash && (
        <MenuItem
          disabled={!actions.squashEnabled}
          onClick={() => onAction("squash")}
        >
          <GitMerge />
          {t("workspace:reviews.prActions.squashMerge")}
        </MenuItem>
      )}
      {actions.close && (
        <MenuItem variant="destructive" onClick={() => onAction("close")}>
          <GitPullRequestClosed />
          {t("workspace:reviews.prActions.closePullRequest")}
        </MenuItem>
      )}
      {actions.edit && (
        <>
          <MenuSeparator />
          <PullRequestReviewersSubmenu
            pullRef={pullRef}
            pull={{
              author: pr.author,
              requestedReviewers: requestedReviewers(pr),
            }}
          />
        </>
      )}
    </ContextMenuContent>
  );
}
