import { Link, useLocation } from "@tanstack/react-router";
import {
  Box,
  ChevronRight,
  CircleArrowDown,
  CirclePlay,
  House,
  Layers,
  Layers2,
  MoreHorizontal,
} from "lucide-react";
import type { PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import type { LeavingTeam } from "@/components/team/leave-team-dialog";
import { TeamMenuItems } from "@/components/team/team-menu-items";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import {
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import icons from "@/constants/project-icons";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import { triageTasks } from "@/lib/status-category";
import { teamColor } from "@/lib/team-color";
import { useUserPreferencesStore } from "@/store/user-preferences";

type Team = {
  id: string;
  name: string;
  icon: string | null;
  cyclesEnabled?: boolean | null;
};

/** One team in the sidebar: its row, ··· menu and collapsible pages. */
export function TeamNavRow({
  workspaceId,
  project,
  isCurrent,
  hoverPrefetch,
  onLeave,
}: {
  workspaceId: string;
  project: Team;
  isCurrent: boolean;
  hoverPrefetch: {
    onPointerEnter: (event: PointerEvent) => void;
    onPointerLeave: () => void;
  };
  onLeave: (team: LeavingTeam) => void;
}) {
  const { t } = useTranslation();
  const { isMobile } = useSidebar();
  const { pathname } = useLocation();
  const collapsedNavIds = useUserPreferencesStore((s) => s.collapsedNavIds);
  const setNavOpen = useUserPreferencesStore((s) => s.setNavOpen);
  const ProjectIcon = icons[project.icon as keyof typeof icons] || icons.Layout;

  return (
    <Collapsible
      open={!collapsedNavIds.includes(`team:${project.id}`)}
      onOpenChange={(open) => setNavOpen(`team:${project.id}`, open)}
      className="group/team"
    >
      <CollapsibleTrigger
        className="data-panel-open:[&_.team-chevron]:rotate-90"
        nativeButton
        render={<SidebarMenuButton size="default" {...hoverPrefetch} />}
      >
        <ProjectIcon
          aria-hidden="true"
          style={{ color: teamColor(project.id) }}
        />
        <span className="min-w-0 truncate">{project.name}</span>
        <ChevronRight className="team-chevron ml-0.5 size-3! text-sidebar-foreground/60 transition-transform duration-150 group-focus-within/menu-item:opacity-0 group-hover/menu-item:opacity-0" />
      </CollapsibleTrigger>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              // The row is the drag source; this press
              // must not reach it.
              onPointerDown={(event) => event.stopPropagation()}
              className="absolute top-0.5 right-1 flex size-6 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-hidden ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 peer-hover/menu-button:text-sidebar-accent-foreground after:-inset-2 after:absolute md:after:hidden [&>svg]:size-4 group-data-[collapsible=icon]:hidden group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-popup-open:opacity-100 peer-data-[active=true]/menu-button:text-sidebar-accent-foreground md:opacity-0"
            />
          }
        >
          <MoreHorizontal />
          <span className="sr-only">{t("navigation:sidebar.more")}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="min-w-44 rounded-lg"
          side={isMobile ? "bottom" : "right"}
          align={isMobile ? "end" : "start"}
        >
          <TeamMenuItems
            workspaceId={workspaceId}
            projectId={project.id}
            onLeave={onLeave}
          />
        </DropdownMenuContent>
      </DropdownMenu>
      <CollapsiblePanel>
        <ProjectSubNav
          workspaceId={workspaceId}
          projectId={project.id}
          pathname={pathname}
          isCurrent={isCurrent}
          cyclesEnabled={!!project.cyclesEnabled}
        />
      </CollapsiblePanel>
    </Collapsible>
  );
}

function ProjectSubNav({
  workspaceId,
  projectId,
  pathname,
  isCurrent,
  cyclesEnabled,
}: {
  workspaceId: string;
  projectId: string;
  pathname: string;
  isCurrent: boolean;
  cyclesEnabled: boolean;
}) {
  const { t } = useTranslation();
  const { data } = useGetTasks(projectId, { refetchOnMount: false });
  const triageCount = data ? triageTasks(data).length : 0;
  return (
    <SidebarMenuSub className="mx-0 translate-x-0 gap-px border-0 py-0.5 pr-0 pl-4">
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          isActive={isCurrent && pathname.endsWith("/home")}
          render={
            <Link
              to="/dashboard/workspace/$workspaceId/project/$projectId/home"
              params={{ workspaceId, projectId }}
            />
          }
        >
          <House aria-hidden="true" />
          <span>{t("navigation:sidebar.teamHome")}</span>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          isActive={isCurrent && pathname.endsWith("/triage")}
          render={
            <Link
              to="/dashboard/workspace/$workspaceId/project/$projectId/triage"
              params={{ workspaceId, projectId }}
            />
          }
        >
          <CircleArrowDown aria-hidden="true" />
          <span>{t("navigation:sidebar.triage")}</span>
          {triageCount > 0 && (
            <span className="ml-auto font-normal text-muted-foreground text-xs tabular-nums">
              {triageCount}
            </span>
          )}
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          isActive={isCurrent && pathname.endsWith("/board")}
          render={
            <Link
              to="/dashboard/workspace/$workspaceId/project/$projectId/board"
              params={{ workspaceId, projectId }}
            />
          }
        >
          <Layers aria-hidden="true" />
          <span>{t("navigation:sidebar.issues")}</span>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
      {cyclesEnabled && (
        <SidebarMenuSubItem>
          <SidebarMenuSubButton
            isActive={isCurrent && pathname.endsWith("/cycles")}
            render={
              <Link
                to="/dashboard/workspace/$workspaceId/project/$projectId/cycles"
                params={{ workspaceId, projectId }}
              />
            }
          >
            <CirclePlay aria-hidden="true" />
            <span>{t("navigation:sidebar.cycles")}</span>
          </SidebarMenuSubButton>
          {(["active", "upcoming"] as const).map((alias) => (
            <SidebarMenuSubButton
              key={alias}
              className="pl-7"
              isActive={isCurrent && pathname.endsWith(`/cycle/${alias}`)}
              render={
                <Link
                  to="/dashboard/workspace/$workspaceId/project/$projectId/cycle/$cycleId"
                  params={{ workspaceId, projectId, cycleId: alias }}
                />
              }
            >
              <span>
                {t(
                  alias === "active"
                    ? "navigation:sidebar.currentCycle"
                    : "navigation:sidebar.upcomingCycle",
                )}
              </span>
            </SidebarMenuSubButton>
          ))}
        </SidebarMenuSubItem>
      )}
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          isActive={isCurrent && pathname.endsWith("/projects")}
          render={
            <Link
              to="/dashboard/workspace/$workspaceId/project/$projectId/projects"
              params={{ workspaceId, projectId }}
            />
          }
        >
          <Box aria-hidden="true" />
          <span>{t("navigation:sidebar.teamProjects")}</span>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          isActive={isCurrent && pathname.endsWith("/views")}
          render={
            <Link
              to="/dashboard/workspace/$workspaceId/project/$projectId/views"
              params={{ workspaceId, projectId }}
            />
          }
        >
          <Layers2 aria-hidden="true" />
          <span>{t("navigation:sidebar.views")}</span>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    </SidebarMenuSub>
  );
}
