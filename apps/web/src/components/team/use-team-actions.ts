import { Link as LinkIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFavorite } from "@/hooks/queries/favorite/use-favorites";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";
import { toast } from "@/lib/toast";

/** The team actions the ··· menu and its keyboard shortcuts share. */
export function useTeamActions(workspaceId: string, projectId: string) {
  const { t } = useTranslation();
  const { isFavorite, toggle } = useFavorite(workspaceId, {
    type: "project",
    targetId: projectId,
  });
  const copyUrl = () => {
    navigator.clipboard.writeText(
      `${window.location.origin}/dashboard/workspace/${workspaceId}/project/${projectId}`,
    );
    toast.success(t("navigation:projectList.linkCopied"), { icon: LinkIcon });
  };
  return { isFavorite, toggleFavorite: toggle, copyUrl };
}

/** Linear's team page shortcuts: Alt+F favorites, Cmd+Shift+, copies the URL. */
export function useTeamShortcuts(workspaceId: string, projectId: string) {
  const { toggleFavorite, copyUrl } = useTeamActions(workspaceId, projectId);
  useShortcut("toggleTeamFavorite", toggleFavorite);
  useShortcut("copyTeamUrl", copyUrl);
}
