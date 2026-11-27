import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  restrictToFirstScrollableAncestor,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link, useParams } from "@tanstack/react-router";
import { ChannelsNav } from "@/components/chat/channels-nav";
import { DirectMessagesNav } from "@/components/chat/direct-messages-nav";
import { DraftsNav } from "@/components/chat/drafts-nav";
import { FavoritesNav } from "@/components/team/favorites-nav";
import {
  LeaveTeamDialog,
  type LeavingTeam,
} from "@/components/team/leave-team-dialog";
import { TeamNavRow } from "@/components/team/team-nav-row";
import { ChevronRight, Plus } from "lucide-react";
import { type CSSProperties, type ReactNode, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import useReorderProjects from "@/hooks/mutations/project/use-reorder-projects";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { useBoardHoverPrefetch } from "@/hooks/use-board-hover-prefetch";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { EASE_OUT_CSS } from "@/lib/motion";
import { toast } from "@/lib/toast";
import CreateProjectModal from "./shared/modals/create-project-modal";

function SortableProjectItem({
  id,
  canReorder,
  children,
}: {
  id: string;
  canReorder: boolean;
  children: ReactNode;
}) {
  const { listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id,
      disabled: !canReorder,
      // The reorder already moves the row; animating the index change too
      // replays the same move from a stale offset.
      animateLayoutChanges: () => false,
      // dnd-kit defaults to `ease`; this is the app's curve.
      transition: { duration: 200, easing: EASE_OUT_CSS },
    });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    // `listeners` without `attributes`: the latter puts role="button" and a tab
    // stop on the row, wrapping the link and the dropdown inside it.
    <SidebarMenuItem
      ref={setNodeRef}
      style={style}
      data-kaneo-sortable=""
      className={isDragging ? "opacity-0" : undefined}
      {...(canReorder ? listeners : {})}
    >
      {children}
    </SidebarMenuItem>
  );
}

export function NavProjects() {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const collapsedNavIds = useUserPreferencesStore((s) => s.collapsedNavIds);
  const setNavOpen = useUserPreferencesStore((s) => s.setNavOpen);
  const { data: projects } = useGetProjects(
    {
      workspaceId: workspace?.id || "",
    },
    true,
  );
  const reorderProjects = useReorderProjects();
  const { canCreateProjects, canUpdateProjects } = useWorkspacePermission();
  const canCreate = canCreateProjects();
  // Matches the API, which gates /project/reorder on `project: ["update"]`
  // alone — not the create+update+delete bundle.
  const canReorder = canUpdateProjects();
  const boardHoverPrefetch = useBoardHoverPrefetch(workspace?.id ?? "");
  const { workspaceId: currentWorkspaceId, projectId: currentProjectId } =
    useParams({
      strict: false,
    });

  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] =
    useState(false);
  const [leaving, setLeaving] = useState<LeavingTeam | null>(null);
  const [draggingProjectId, setDraggingProjectId] = useState<string | null>(
    null,
  );

  // Linear: "Your teams" lists the teams you joined; a team you open
  // without joining shows under "Exploring" while you are on it.
  const joined = projects?.filter((project) => project.membership.joined) ?? [];
  const exploring = projects?.find(
    (project) =>
      project.id === currentProjectId &&
      currentWorkspaceId === workspace?.id &&
      !project.membership.joined,
  );

  const draggingProject = joined.find(
    (project) => project.id === draggingProjectId,
  );

  const isCurrentProject = (projectId: string) => {
    return (
      currentProjectId === projectId && currentWorkspaceId === workspace?.id
    );
  };

  // Below these thresholds the row is still a link and the sidebar still
  // scrolls; above them the gesture becomes a drag.
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    document.body.classList.add("kaneo-dragging");
    setDraggingProjectId(String(event.active.id));
  };

  const endDrag = () => {
    document.body.classList.remove("kaneo-dragging");
    setDraggingProjectId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    endDrag();

    if (!over || active.id === over.id || !projects || !workspace) return;

    const oldIndex = joined.findIndex((project) => project.id === active.id);
    const newIndex = joined.findIndex((project) => project.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Teams you left keep their slots; only the joined ones trade places.
    const moved = arrayMove(joined, oldIndex, newIndex);
    let next = 0;
    const reordered = projects.map((project) =>
      project.membership.joined ? (moved[next++] ?? project) : project,
    );

    reorderProjects(workspace.id, reordered, {
      onError: () => {
        toast.error(t("workspace:projects.reorderError"));
      },
    });
  };

  if (!workspace) return null;

  return (
    <>
      <FavoritesNav workspaceId={workspace.id} />
      <ChannelsNav workspaceId={workspace.id} />
      <DirectMessagesNav workspaceId={workspace.id} />
      <DraftsNav workspaceId={workspace.id} />
      <Collapsible
        open={!collapsedNavIds.includes("your-teams")}
        onOpenChange={(open) => setNavOpen("your-teams", open)}
        className="group/collapsible"
      >
        <SidebarGroup className="group-data-[collapsible=icon]:hidden gap-1 p-2 pt-1">
          <CollapsibleTrigger
            className="data-panel-open:[&_svg]:rotate-90"
            render={
              <SidebarGroupLabel className="h-7 cursor-pointer justify-start gap-1 px-2 text-xs text-sidebar-foreground" />
            }
          >
            <span>{t("navigation:sidebar.yourTeams")}</span>
            <ChevronRight className="h-3 w-3 text-sidebar-foreground/60 transition-transform duration-200" />
          </CollapsibleTrigger>
          {canCreate && (
            <SidebarGroupAction
              className="top-1.5 right-2 text-sidebar-foreground/70"
              title={t("navigation:projectList.addProject")}
              onClick={() => setIsCreateProjectModalOpen(true)}
            >
              <Plus />
              <span className="sr-only">
                {t("navigation:projectList.addProject")}
              </span>
            </SidebarGroupAction>
          )}
          <CollapsiblePanel className="-m-1 p-1">
            <SidebarGroupContent>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[
                  restrictToVerticalAxis,
                  restrictToFirstScrollableAncestor,
                ]}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={endDrag}
              >
                <SidebarMenu className="gap-px">
                  <SortableContext
                    items={joined.map((project) => project.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {joined.map((project) => (
                      <SortableProjectItem
                        key={project.id}
                        id={project.id}
                        canReorder={canReorder}
                      >
                        <TeamNavRow
                          workspaceId={workspace.id}
                          project={project}
                          isCurrent={isCurrentProject(project.id)}
                          hoverPrefetch={boardHoverPrefetch(project.id)}
                          onLeave={setLeaving}
                        />
                      </SortableProjectItem>
                    ))}
                  </SortableContext>
                  {projects && joined.length === 0 && (
                    // Someone who left every team still needs a way back in.
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        className="text-sidebar-foreground/70"
                        render={<Link to="/dashboard/settings/projects" />}
                      >
                        <span>{t("navigation:sidebar.browseTeams")}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>

                {/* Portalled: `SidebarContent` is `overflow-auto` and clips it. */}
                {createPortal(
                  <DragOverlay dropAnimation={null}>
                    {draggingProject ? (
                      <div className="flex h-8 w-(--sidebar-width) max-w-64 items-center rounded-lg border bg-sidebar not-dark:bg-clip-padding px-2 text-sm text-sidebar-accent-foreground shadow-lg/5">
                        <span className="truncate">{draggingProject.name}</span>
                      </div>
                    ) : null}
                  </DragOverlay>,
                  document.body,
                )}
              </DndContext>
            </SidebarGroupContent>
          </CollapsiblePanel>
        </SidebarGroup>
      </Collapsible>

      {exploring && (
        <SidebarGroup className="group-data-[collapsible=icon]:hidden gap-1 p-2 pt-1">
          <SidebarGroupLabel className="h-7 px-2 text-xs text-sidebar-foreground">
            {t("navigation:sidebar.exploring")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-px">
              <SidebarMenuItem>
                <TeamNavRow
                  workspaceId={workspace.id}
                  project={exploring}
                  isCurrent
                  hoverPrefetch={boardHoverPrefetch(exploring.id)}
                  onLeave={setLeaving}
                />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}

      <CreateProjectModal
        open={isCreateProjectModalOpen}
        onClose={() => setIsCreateProjectModalOpen(false)}
      />

      <LeaveTeamDialog
        workspaceId={workspace.id}
        team={leaving}
        onClose={() => setLeaving(null)}
      />
    </>
  );
}
