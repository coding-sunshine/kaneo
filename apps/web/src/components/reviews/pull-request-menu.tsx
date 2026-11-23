import { Check, Copy, ExternalLink, Link2, MoreHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
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
import { copyText } from "@/lib/copy-text";

/** The header's ⋯ menu: the Linear actions that Kaneo has data or an API for. */
export function PullRequestMenu({
  pullRef,
  pull,
}: {
  pullRef: PullRef;
  pull: PullRequestDetail;
}) {
  const { t } = useTranslation();
  const { markReady, pending } = useReadyForReview(pullRef);
  const copy = (text: string, key: string) =>
    copyText(
      text,
      t(`workspace:reviews.detail.menu.${key}Copied`),
      t("workspace:reviews.detail.menu.copyFailed"),
    );

  return (
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
        <MenuItem onClick={() => copy(pull.url, "githubUrl")}>
          <Copy />
          {t("workspace:reviews.detail.menu.copyGithubUrl")}
        </MenuItem>
        <MenuItem onClick={() => copy(pull.headRef, "branch")}>
          <Copy />
          {t("workspace:reviews.detail.menu.copyBranch")}
        </MenuItem>
        <MenuItem onClick={() => copy(window.location.href, "reviewUrl")}>
          <Link2 />
          {t("workspace:reviews.detail.menu.copyReviewUrl")}
        </MenuItem>
        {pull.status === "draft" && (
          <>
            <MenuSeparator />
            <MenuItem disabled={pending} onClick={markReady}>
              <Check />
              {t("workspace:reviews.detail.menu.markReady")}
            </MenuItem>
          </>
        )}
      </MenuPopup>
    </Menu>
  );
}
