import { useNavigate } from "@tanstack/react-router";
import { Archive, Bell, Link as LinkIcon, Settings, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LeavingTeam } from "@/components/team/leave-team-dialog";
import {
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/menu";
import useUpdateTeamMembership from "@/hooks/mutations/project/use-update-team-membership";
import { useFavorite } from "@/hooks/queries/favorite/use-favorites";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { toast } from "@/lib/toast";

type TeamMenuItemsProps = {
  workspaceId: string;
  projectId: string;
  /** Opens the leave confirmation, which outlives this menu. */
  onLeave: (team: LeavingTeam) => void;
};

const item = "h-7 items-start cursor-pointer text-sm";

const SUBSCRIPTIONS = [
  ["notifyIssueAdded", "subscribeIssueAdded"],
  ["notifyIssueClosed", "subscribeIssueClosed"],
  ["notifyIssueTriage", "subscribeIssueTriage"],
] as const;

/** Linear's team menu: favorite | settings, URL, archive | subscribe | leave or join. */
export function TeamMenuItems({
  workspaceId,
  projectId,
  onLeave,
}: TeamMenuItemsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isFavorite, toggle } = useFavorite(workspaceId, {
    type: "project",
    targetId: projectId,
  });
  const { data: projects } = useGetProjects({ workspaceId });
  const team = projects?.find((project) => project.id === projectId);
  const { mutate } = useUpdateTeamMembership(workspaceId);
  const update = (changes: Parameters<typeof mutate>[0]) =>
    mutate(changes, { onError: (error) => toast.error(error.message) });

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
      {team && (
        <>
          <DropdownMenuSeparator />
          {team.membership.joined && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger
                className={`${item} [&>svg:first-child]:-mx-0.5`}
              >
                <Bell className="text-muted-foreground" />
                <span>{t("navigation:projectList.subscribe")}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-72 rounded-lg">
                {SUBSCRIPTIONS.map(([flag, label]) => (
                  <DropdownMenuCheckboxItem
                    key={flag}
                    className="cursor-pointer"
                    checked={team.membership[flag]}
                    onCheckedChange={(checked) =>
                      update({ projectId, [flag]: checked })
                    }
                  >
                    {t(`navigation:projectList.${label}`)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          {team.membership.joined && <DropdownMenuSeparator />}
          {/* Linear's leave row has no icon and no danger colour. */}
          <DropdownMenuItem
            className={item}
            onClick={() =>
              team.membership.joined
                ? onLeave({ id: team.id, name: team.name })
                : update({ projectId, joined: true })
            }
          >
            <span>
              {team.membership.joined
                ? t("navigation:projectList.leaveTeam")
                : t("navigation:projectList.joinTeam")}
            </span>
          </DropdownMenuItem>
        </>
      )}
    </>
  );
}
