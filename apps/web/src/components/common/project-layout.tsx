import { ShortcutKeys } from "@/components/shortcuts/shortcut-keys";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Bell, ChevronRight, MoreHorizontal, Plus } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import MobileProjectNav from "@/components/common/header/mobile-project-nav";
import ProjectCrumbSelect from "@/components/common/header/project-crumb-select";
import Layout from "@/components/common/layout";
import { ProjectScopeToggle } from "@/components/project/views/project-scope-toggle";
import {
  PROJECT_ROUTE_PATHS,
  type ProjectRoute,
  resolveProjectView,
} from "@/components/project/views/project-views";
import { useGoToProjectView } from "@/components/project/views/use-go-to-project-view";
import { ViewToggle } from "@/components/project/views/view-toggle";
import { useProjectViewShortcuts } from "@/components/project/views/use-project-view-shortcuts";
import { FavoriteStar } from "@/components/common/favorite-star";
import { TeamMenuItems } from "@/components/team/team-menu-items";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import CreateProjectModal from "@/components/shared/modals/create-project-modal";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import useGetProject from "@/hooks/queries/project/use-get-project";
import { useProjectWebSocket } from "@/hooks/use-project-websocket";
import { cn } from "@/lib/cn";
import { getProjectUnavailableReason } from "@/lib/project-unavailable-reason";
import { useBackgroundStore } from "@/store/background";
import { useCreateIssueStore } from "@/store/create-issue";
import { useUserPreferencesStore } from "@/store/user-preferences";
import ProjectUnavailable from "./project-unavailable";

type ProjectLayoutProps = {
  projectId: string;
  workspaceId: string;
  toolbar?: ReactNode;
  summary?: ReactNode;
  filterBar?: ReactNode;
  children: ReactNode;
  showViewSwitcher?: boolean;
  activeView?: ProjectRoute;
  crumb?: string;
};

export default function ProjectLayout({
  projectId,
  workspaceId,
  toolbar,
  summary,
  filterBar,
  children,
  showViewSwitcher = true,
  activeView,
  crumb,
}: ProjectLayoutProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: project, error: projectError } = useGetProject({
    id: projectId,
    workspaceId,
  });
  const unavailableReason = getProjectUnavailableReason(projectError);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] =
    useState(false);
  const { background } = useBackgroundStore();
  const viewMode = useUserPreferencesStore((state) => state.viewMode);
  const setCreateIssueOpen = useCreateIssueStore((state) => state.setOpen);

  useProjectWebSocket(unavailableReason ? "" : projectId);

  const resolvedRoute: ProjectRoute =
    activeView ??
    (location.pathname.includes("/backlog")
      ? "backlog"
      : location.pathname.includes("/calendar")
        ? "calendar"
        : location.pathname.includes("/gantt")
          ? "gantt"
          : "board");
  const currentView = resolveProjectView(resolvedRoute, viewMode);
  const showViews = showViewSwitcher && !unavailableReason;

  const goToView = useGoToProjectView({
    workspaceId,
    projectId,
    currentRoute: resolvedRoute,
  });
  useProjectViewShortcuts(goToView, currentView, showViews);

  const handleProjectSwitch = (nextProjectId: string) => {
    navigate({
      to: PROJECT_ROUTE_PATHS[resolvedRoute],
      params: {
        workspaceId,
        projectId: nextProjectId,
      },
    });
  };

  return (
    <>
      <Layout.Header
        className={cn("h-11 border-border/80 px-2", {
          "bg-card/90 backdrop-blur": !!background,
        })}
      >
        <div className="flex w-full min-w-0 items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarTrigger className="-ml-1 h-7 w-7 shrink-0 cursor-pointer text-foreground/85 hover:text-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="flex items-center gap-2 text-[10px]">
                  {t("navigation:settingsLayout.toggleSidebar")}
                  <ShortcutKeys id="toggleSidebar" />
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="h-4 w-px shrink-0 bg-border/80" />

          <div className="hidden min-w-0 items-center gap-1 md:flex">
            <ProjectCrumbSelect
              workspaceId={workspaceId}
              projectId={projectId}
              projectName={project?.name}
              onSelectProject={handleProjectSwitch}
              onAddProject={() => setIsCreateProjectModalOpen(true)}
            />
            <ChevronRight className="size-3 text-muted-foreground" />
            <span className="px-1 text-[13px] text-muted-foreground">
              {crumb ?? t("navigation:sidebar.issues")}
            </span>
            <FavoriteStar
              workspaceId={workspaceId}
              target={{ type: "project", targetId: projectId }}
            />
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={t("navigation:projectList.moreMenu")}
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <MoreHorizontal className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="min-w-44 rounded-lg"
                align="start"
              >
                <TeamMenuItems
                  workspaceId={workspaceId}
                  projectId={projectId}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="min-w-0 md:hidden">
            <MobileProjectNav
              workspaceId={workspaceId}
              projectId={projectId}
              projectName={project?.name}
              onSelectProject={handleProjectSwitch}
              onAddProject={() => setIsCreateProjectModalOpen(true)}
            />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Link
              to="/dashboard/workspace/$workspaceId/inbox"
              params={{ workspaceId }}
              aria-label={t("navigation:sidebar.inbox")}
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Bell className="size-4" />
            </Link>
            <button
              type="button"
              onClick={() => setCreateIssueOpen(true)}
              className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-[13px] font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="size-3.5" />
              {t("navigation:sidebar.newIssue")}
            </button>
          </div>
        </div>
      </Layout.Header>

      {unavailableReason ||
      !(showViewSwitcher || summary || toolbar || filterBar) ? null : (
        <TooltipProvider>
          <div
            className={cn(
              "flex h-11 shrink-0 items-center gap-2.5 border-border/80 border-b px-2 sm:px-3",
              { "bg-card/80 backdrop-blur": !!background },
            )}
          >
            {showViewSwitcher && (
              <ProjectScopeToggle
                workspaceId={workspaceId}
                projectId={projectId}
                highlight={resolvedRoute === "board"}
              />
            )}
            {summary}
            <div className="ml-auto flex shrink-0 items-center gap-1">
              {showViews && resolvedRoute === "board" && (
                <ViewToggle
                  workspaceId={workspaceId}
                  projectId={projectId}
                  currentRoute={resolvedRoute}
                  currentView={currentView}
                />
              )}
              {toolbar}
            </div>
          </div>
          <div className={cn({ "bg-card/80 backdrop-blur": !!background })}>
            {filterBar}
          </div>
        </TooltipProvider>
      )}

      <Layout.Content>
        {unavailableReason ? (
          <ProjectUnavailable
            reason={unavailableReason}
            workspaceId={workspaceId}
          />
        ) : (
          children
        )}
      </Layout.Content>

      <CreateProjectModal
        open={isCreateProjectModalOpen}
        onClose={() => setIsCreateProjectModalOpen(false)}
      />
    </>
  );
}
