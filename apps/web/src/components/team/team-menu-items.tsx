import { useNavigate } from "@tanstack/react-router";
import { Archive, Bell, Link as LinkIcon, Settings, Star } from "lucide-react";
import { SlackIcon } from "@/components/icons/slack-icon";
import { useTranslation } from "react-i18next";
import { ShortcutKeys } from "@/components/shortcuts/shortcut-keys";
import type { LeavingTeam } from "@/components/team/leave-team-dialog";
import { useTeamActions } from "@/components/team/use-team-actions";
import {
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/menu";
import useUpdateTeamMembership from "@/hooks/mutations/project/use-update-team-membership";
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
  const { isFavorite, toggleFavorite, copyUrl } = useTeamActions(
    workspaceId,
    projectId,
  );
  const { data: projects } = useGetProjects({ workspaceId });
  const team = projects?.find((project) => project.id === projectId);
  const { mutate } = useUpdateTeamMembership(workspaceId);
  const update = (changes: Parameters<typeof mutate>[0]) =>
    mutate(changes, { onError: (error) => toast.error(error.message) });

  return (
    <>
      <DropdownMenuItem className={item} onClick={toggleFavorite}>
        <Star className="text-muted-foreground" />
        <span>
          {isFavorite
            ? t("navigation:projectList.unfavorite")
            : t("navigation:projectList.favorite")}
        </span>
        <ShortcutKeys
          id="toggleTeamFavorite"
          tone="muted"
          className="ms-auto"
        />
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
      <DropdownMenuItem className={item} onClick={copyUrl}>
        <LinkIcon className="text-muted-foreground" />
        <span>{t("navigation:projectList.copyUrl")}</span>
        <ShortcutKeys id="copyTeamUrl" tone="muted" className="ms-auto" />
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
          <DropdownMenuItem
            className={item}
            onClick={() =>
              navigate({
                to: "/dashboard/settings/projects/$projectId/integrations",
                params: { projectId },
                hash: "slack",
              })
            }
          >
            <SlackIcon className="size-4 text-muted-foreground" />
            <span>{t("navigation:projectList.configureSlack")}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
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
