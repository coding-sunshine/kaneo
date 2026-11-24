import {
  Check,
  ExternalLink,
  GitMerge,
  GitPullRequestClosed,
  GitPullRequestDraft,
  Link2,
  MoreHorizontal,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LinkIssueDialog } from "@/components/reviews/link-issue-dialog";
import {
  PullRequestActionDialog,
  type PullRequestAction,
} from "@/components/reviews/pull-request-action-dialog";
import { PullRequestCopySubmenu } from "@/components/reviews/pull-request-copy-submenu";
import { PullRequestCreateIssueItem } from "@/components/reviews/pull-request-create-issue-item";
import { PullRequestFavoriteItem } from "@/components/reviews/pull-request-favorite-item";
import { PullRequestOwnerSubmenu } from "@/components/reviews/pull-request-owner-submenu";
import { PullRequestLabelsSubmenu } from "@/components/reviews/pull-request-labels-submenu";
import { PullRequestReviewersSubmenu } from "@/components/reviews/pull-request-reviewers-submenu";
import { PullRequestSnoozeSubmenu } from "@/components/reviews/pull-request-snooze-submenu";
import { useReadyForReview } from "@/components/reviews/use-ready-for-review";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import type {
  PullRef,
  PullRequestDetail,
} from "@/fetchers/github-reviews/github-reviews";

/** The header's ⋯ menu, in Linear's order; GitHub writes ask first. */
export function PullRequestMenu({
  pullRef,
  pull,
  workspaceId,
}: {
  pullRef: PullRef;
  pull: PullRequestDetail;
  workspaceId: string;
}) {
  const { t } = useTranslation();
  const { markReady, pending } = useReadyForReview(pullRef);
  const [action, setAction] = useState<PullRequestAction | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const live = pull.status === "open" || pull.status === "draft";

  return (
    <>
      <Menu>
        <MenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              className="shrink-0"
              aria-label={t("workspace:reviews.detail.menu.label")}
            />
          }
        >
          <MoreHorizontal />
        </MenuTrigger>
        <MenuPopup align="end" className="min-w-56">
          <MenuItem
            render={
              <a href={pull.url} target="_blank" rel="noopener noreferrer" />
            }
          >
            <ExternalLink />
            {t("workspace:reviews.detail.openOnGithub")}
          </MenuItem>
          <PullRequestFavoriteItem
            pullRef={pullRef}
            workspaceId={workspaceId}
          />
          <PullRequestSnoozeSubmenu pull={pull} />
          <MenuSeparator />
          <PullRequestCopySubmenu pull={pull} workspaceId={workspaceId} />
          <MenuSeparator />
          {live && !pull.issue && (
            <MenuItem onClick={() => setLinkOpen(true)}>
              <Link2 />
              {t("workspace:reviews.prActions.linkIssue")}
            </MenuItem>
          )}
          {live && <PullRequestCreateIssueItem pull={pull} />}
          <PullRequestOwnerSubmenu
            pullRef={pullRef}
            workspaceId={workspaceId}
            pull={pull}
          />
          {live && (
            <>
              <PullRequestLabelsSubmenu
                pullRef={pullRef}
                labels={pull.labels}
              />
              <PullRequestReviewersSubmenu pullRef={pullRef} pull={pull} />
              <MenuSeparator />
              {pull.status === "draft" ? (
                <MenuItem disabled={pending} onClick={markReady}>
                  <Check />
                  {t("workspace:reviews.detail.menu.markReady")}
                </MenuItem>
              ) : (
                <MenuItem onClick={() => setAction("draft")}>
                  <GitPullRequestDraft />
                  {t("workspace:reviews.prActions.convertToDraft")}
                </MenuItem>
              )}
              <MenuItem
                disabled={pull.status !== "open" || pull.mergeable !== true}
                onClick={() => setAction("squash")}
              >
                <GitMerge />
                {t("workspace:reviews.prActions.squashMerge")}
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                variant="destructive"
                onClick={() => setAction("close")}
              >
                <GitPullRequestClosed />
                {t("workspace:reviews.prActions.closePullRequest")}
              </MenuItem>
            </>
          )}
        </MenuPopup>
      </Menu>
      <LinkIssueDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        pullRef={pullRef}
        pull={pull}
        workspaceId={workspaceId}
      />
      <PullRequestActionDialog
        pullRef={pullRef}
        pull={pull}
        action={action}
        onClose={() => setAction(null)}
      />
    </>
  );
}
