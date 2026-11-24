import { Sparkles, SquareTerminal } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CopyablePull } from "@/components/reviews/pull-request-copy";
import { usePullRequestCopy } from "@/components/reviews/use-pull-request-copy";
import {
  MenuItem,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
} from "@/components/ui/menu";

/**
 * Linear's "Work on pull request": hands the pull request to a coding tool.
 * ponytail: only "Copy as prompt". Linear also lists "Open in <tool>" for each coding tool
 * and "Configure coding tools…"; add them when the app has coding tool settings.
 */
export function PullRequestWorkSubmenu({
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
        <SquareTerminal />
        {t("workspace:reviews.prActions.workOn")}
      </MenuSubTrigger>
      <MenuSubPopup className="min-w-52">
        <MenuItem onClick={copy.asPrompt}>
          <Sparkles />
          {t("workspace:reviews.copyMenu.asPrompt")}
        </MenuItem>
      </MenuSubPopup>
    </MenuSub>
  );
}
