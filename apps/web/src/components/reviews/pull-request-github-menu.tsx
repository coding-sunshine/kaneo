import {
  Copy,
  ExternalLink,
  GitBranch,
  GitPullRequest,
  Link2,
  Link as LinkIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CopyablePull } from "@/components/reviews/pull-request-copy";
import { PullRequestCopyNumberSubmenu } from "@/components/reviews/pull-request-copy-number-submenu";
import { usePullRequestCopy } from "@/components/reviews/use-pull-request-copy";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";

/** The "repo#number" chip, which opens Linear's pull request actions menu. */
export function PullRequestGithubMenu({
  pull,
  workspaceId,
}: {
  pull: CopyablePull;
  workspaceId: string;
}) {
  const { t } = useTranslation();
  const copy = usePullRequestCopy(pull, workspaceId);
  const name = `${pull.repo}#${pull.number}`;
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            className="shrink-0 font-mono text-muted-foreground max-sm:hidden"
            aria-label={t("workspace:reviews.prActions.githubChip", { name })}
          />
        }
      >
        <GitPullRequest />
        {name}
      </MenuTrigger>
      <MenuPopup align="end" className="min-w-60">
        <MenuItem
          render={
            <a href={pull.url} target="_blank" rel="noopener noreferrer" />
          }
        >
          <ExternalLink />
          {t("workspace:reviews.detail.openOnGithub")}
        </MenuItem>
        <MenuItem onClick={copy.githubUrl}>
          <Copy />
          {t("workspace:reviews.copyMenu.githubUrl")}
        </MenuItem>
        <MenuSeparator />
        {copy.branch && (
          <MenuItem onClick={copy.branch}>
            <GitBranch />
            {t("workspace:reviews.copyMenu.branch")}
          </MenuItem>
        )}
        <PullRequestCopyNumberSubmenu copy={copy} />
        <MenuItem onClick={copy.reviewUrl}>
          <Link2 />
          {t("workspace:reviews.copyMenu.reviewUrl")}
        </MenuItem>
        <MenuItem onClick={copy.titleAsLink}>
          <LinkIcon />
          {t("workspace:reviews.copyMenu.titleAsLink")}
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
}
