import { useRouter } from "@tanstack/react-router";
import { ExternalLink, Settings, Sparkles, SquareTerminal } from "lucide-react";
import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import type { CopyablePull } from "@/components/reviews/pull-request-copy";
import { usePullRequestCopy } from "@/components/reviews/use-pull-request-copy";
import { ShortcutKeys } from "@/components/shortcuts/shortcut-keys";
import {
  MenuItem,
  MenuSeparator,
  MenuShortcut,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
} from "@/components/ui/menu";
import {
  buildCodingToolUrl,
  CODING_TOOLS_SETTINGS_PATH,
} from "@/lib/coding-tools";
import { useUserPreferencesStore } from "@/store/user-preferences";

/**
 * Linear's "Work on pull request": opens the pull request in configured coding tools,
 * copies it as a prompt, or jumps to coding tool settings.
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
  const router = useRouter({ warn: false });
  const codingTools = useUserPreferencesStore((state) => state.codingTools);

  const toolEntries = codingTools.flatMap((tool) => {
    if (!tool.enabled) return [];
    const href = buildCodingToolUrl(tool.urlTemplate, pull);
    return href ? [{ tool, href }] : [];
  });

  const handleConfigureClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      !router ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return;
    }
    event.preventDefault();
    void router.navigate({
      to: "/dashboard/settings/account/preferences",
      hash: "coding-tools",
    });
  };

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
        {toolEntries.map(({ tool, href }) => (
          <MenuItem
            key={tool.id}
            render={<a href={href} target="_blank" rel="noopener noreferrer" />}
          >
            <ExternalLink />
            {t("workspace:reviews.workMenu.openIn", { tool: tool.name })}
          </MenuItem>
        ))}
        {toolEntries.length > 0 && <MenuSeparator />}
        <MenuItem onClick={copy.asPrompt}>
          <Sparkles />
          {t("workspace:reviews.copyMenu.asPrompt")}
          {shortcuts && (
            <MenuShortcut>
              <ShortcutKeys id="copyPullRequestPrompt" tone="muted" />
            </MenuShortcut>
          )}
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          render={
            <a
              href={CODING_TOOLS_SETTINGS_PATH}
              onClick={handleConfigureClick}
            />
          }
        >
          <Settings />
          {t("workspace:reviews.workMenu.configure")}
        </MenuItem>
      </MenuSubPopup>
    </MenuSub>
  );
}
