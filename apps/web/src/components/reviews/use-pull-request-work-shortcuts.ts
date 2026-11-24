import { usePullRequestCopy } from "@/components/reviews/use-pull-request-copy";
import type { CopyablePull } from "@/components/reviews/pull-request-copy";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";

/**
 * Linear's two "Work on pull request" shortcuts. W then O opens the submenu (Linear's
 * sub-actions list); Cmd+Alt+P copies the prompt without opening anything.
 */
export function usePullRequestWorkShortcuts(
  pull: CopyablePull,
  workspaceId: string,
  openWorkMenu: () => void,
) {
  const copy = usePullRequestCopy(pull, workspaceId);
  useShortcut("workOnPullRequest", openWorkMenu);
  useShortcut("copyPullRequestPrompt", copy.asPrompt);
}
