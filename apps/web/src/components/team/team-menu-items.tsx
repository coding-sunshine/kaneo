import { useNavigate } from "@tanstack/react-router";
import {
  Archive,
  Link as LinkIcon,
  Settings,
  Star,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/menu";
import { useFavorite } from "@/hooks/queries/favorite/use-favorites";
import { toast } from "@/lib/toast";

type TeamMenuItemsProps = {
  workspaceId: string;
  projectId: string;
  /** Present when the viewer may delete teams. */
  onDelete?: () => void;
};

const item = "h-7 items-start cursor-pointer text-sm";

/** Linear's team menu: favorite, settings, copy URL, archive, then the danger row. */
export function TeamMenuItems({
  workspaceId,
  projectId,
  onDelete,
}: TeamMenuItemsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isFavorite, toggle } = useFavorite(workspaceId, {
    type: "project",
    targetId: projectId,
  });

  return (
    <>
      <DropdownMenuItem className={item} onClick={toggle}>
        <Star className="text-muted-foreground" />
        <span>
          {isFavorite
            ? t("navigation:projectList.unfavorite")
            : t("navigation:projectList.favorite")}
        </span>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        className={item}
        onClick={() =>
          navigate({
            to: "/dashboard/settings/projects/$projectId/general",
            params: { projectId },
          })
        }
      >
        <Settings className="text-muted-foreground" />
        <span>{t("navigation:projectList.teamSettings")}</span>
      </DropdownMenuItem>
      <DropdownMenuItem
        className={item}
        onClick={() => {
          navigator.clipboard.writeText(
            `${window.location.origin}/dashboard/workspace/${workspaceId}/project/${projectId}`,
          );
          toast.success(t("navigation:projectList.linkCopied"), {
            icon: LinkIcon,
          });
        }}
      >
        <LinkIcon className="text-muted-foreground" />
        <span>{t("navigation:projectList.copyUrl")}</span>
      </DropdownMenuItem>
      <DropdownMenuItem
        className={item}
        onClick={() =>
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/archive",
            params: { workspaceId, projectId },
          })
        }
      >
        <Archive className="text-muted-foreground" />
        <span>{t("navigation:projectList.openArchive")}</span>
      </DropdownMenuItem>
      {onDelete && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className={`${item} text-destructive`}
            onClick={onDelete}
          >
            <Trash2 className="text-destructive" />
            <span>{t("navigation:projectList.deleteProject")}</span>
          </DropdownMenuItem>
        </>
      )}
    </>
  );
}
