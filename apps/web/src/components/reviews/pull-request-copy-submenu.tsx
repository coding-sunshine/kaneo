import {
  Copy,
  GitBranch,
  Link2,
  Link as LinkIcon,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CopyablePull } from "@/components/reviews/pull-request-copy";
import { PullRequestCopyNumberSubmenu } from "@/components/reviews/pull-request-copy-number-submenu";
import { usePullRequestCopy } from "@/components/reviews/use-pull-request-copy";
import {
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
} from "@/components/ui/menu";

/** Linear's Copy submenu, for any pull request the caller can describe. */
export function PullRequestCopySubmenu({
  pull,
  workspaceId,
}: {
  pull: CopyablePull;
  workspaceId: string;
}) {
  const { t } = useTranslation();
  const copy = usePullRequestCopy(pull, workspaceId);
  return (
    <MenuSub>
      <MenuSubTrigger>
        <Copy />
        {t("workspace:reviews.copyMenu.label")}
      </MenuSubTrigger>
      <MenuSubPopup className="min-w-60">
        <MenuItem onClick={copy.asPrompt}>
          <Sparkles />
          {t("workspace:reviews.copyMenu.asPrompt")}
        </MenuItem>
        <PullRequestCopyNumberSubmenu copy={copy} />
        <MenuItem onClick={copy.reviewUrl}>
          <Link2 />
          {t("workspace:reviews.copyMenu.reviewUrl")}
        </MenuItem>
        <MenuItem onClick={copy.titleAsLink}>
          <LinkIcon />
          {t("workspace:reviews.copyMenu.titleAsLink")}
        </MenuItem>
        {copy.branch && (
          <MenuItem onClick={copy.branch}>
            <GitBranch />
            {t("workspace:reviews.copyMenu.branch")}
          </MenuItem>
        )}
        <MenuSeparator />
        <MenuItem onClick={copy.githubUrl}>
          <Copy />
          {t("workspace:reviews.copyMenu.githubUrl")}
        </MenuItem>
      </MenuSubPopup>
    </MenuSub>
  );
}
