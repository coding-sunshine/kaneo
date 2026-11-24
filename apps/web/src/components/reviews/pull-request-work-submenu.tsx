import { Sparkles, SquareTerminal } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CopyablePull } from "@/components/reviews/pull-request-copy";
import { usePullRequestCopy } from "@/components/reviews/use-pull-request-copy";
import { ShortcutKeys } from "@/components/shortcuts/shortcut-keys";
import {
  MenuItem,
  MenuShortcut,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
} from "@/components/ui/menu";

/**
 * Linear's "Work on pull request": hands the pull request to a coding tool.
 * ponytail: only "Copy as prompt". Linear also lists "Open in <tool>" for each coding tool
 * and "Configure coding tools…"; add them when the app has coding tool settings.
 * `shortcuts` shows the key hints on the pull request page, the only place they are live.
 */
export function PullRequestWorkSubmenu({
  pull,
  workspaceId,
  shortcuts,
  open,
  onOpenChange,
}: {
  pull: CopyablePull;
  workspaceId: string;
  shortcuts?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const copy = usePullRequestCopy(pull, workspaceId);
  return (
    <MenuSub open={open} onOpenChange={onOpenChange}>
      <MenuSubTrigger>
        <SquareTerminal />
        {t("workspace:reviews.prActions.workOn")}
        {shortcuts && (
          <MenuShortcut className="me-4">
            <ShortcutKeys id="workOnPullRequest" tone="muted" />
          </MenuShortcut>
        )}
      </MenuSubTrigger>
      <MenuSubPopup className="min-w-52">
        <MenuItem onClick={copy.asPrompt}>
          <Sparkles />
          {t("workspace:reviews.copyMenu.asPrompt")}
          {shortcuts && (
            <MenuShortcut>
              <ShortcutKeys id="copyPullRequestPrompt" tone="muted" />
            </MenuShortcut>
          )}
        </MenuItem>
      </MenuSubPopup>
    </MenuSub>
  );
}
