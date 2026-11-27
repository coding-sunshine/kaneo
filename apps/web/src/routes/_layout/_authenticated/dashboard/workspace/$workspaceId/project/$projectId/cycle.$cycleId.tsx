import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SearchXIcon } from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import { CycleSidePanel } from "@/components/cycle/cycle-side-panel";
import KanbanBoard from "@/components/kanban-board";
import ListView from "@/components/list-view";
import PageTitle from "@/components/page-title";
import { DisplaySection } from "@/components/project/display/display-section";
import { TaskDisplayOptions } from "@/components/project/display/task-display-options";
import { ActiveFiltersBar } from "@/components/project/task-filters/active-filters-bar";
import { ProjectToolbar } from "@/components/project/toolbar/project-toolbar";
import { TaskCount } from "@/components/project/toolbar/task-count";
import { useProjectTaskView } from "@/components/project/toolbar/use-project-task-view";
import { LayoutSwitch } from "@/components/project/views/layout-switch";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetCycles } from "@/hooks/queries/cycle/use-get-cycles";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import { useBoardSort } from "@/hooks/use-board-sort";
import { cycleState, cycleTitle } from "@/lib/cycle/cycle-label";
import { sortTasks } from "@/lib/sort-tasks";
import { countColumnTasks } from "@/lib/task-filters/count-tasks";
import useProjectStore from "@/store/project";
import { useUserPreferencesStore } from "@/store/user-preferences";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/cycle/$cycleId",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId, projectId, cycleId } = Route.useParams();
  const { taskId } = Route.useSearch();
  const navigate = useNavigate();
  const { data: cycles, isSuccess: cyclesLoaded } = useGetCycles(projectId);
  const { data: board } = useGetTasks(projectId);
  const viewMode = useUserPreferencesStore((s) => s.viewMode);
  const { sort, setSort } = useBoardSort(projectId);
  const setProject = useProjectStore((state) => state.setProject);

  // Cards read the team key and columns from the store, as on the board.
  useEffect(() => {
    if (board) setProject(board);
  }, [board, setProject]);

  // Linear serves /cycle/active and /cycle/upcoming as aliases.
  const cycle = useMemo(() => {
    if (cycleId === "active")
      return cycles?.find((c) => cycleState(c) === "current");
    if (cycleId === "upcoming")
      return [...(cycles ?? [])]
        .filter((c) => cycleState(c) === "upcoming")
        .sort((a, b) => a.number - b.number)[0];
    return cycles?.find((c) => c.id === cycleId);
  }, [cycles, cycleId]);

  const scoped = useMemo(
    () =>
      board && cycle
        ? {
            ...board,
            columns: board.columns.map((c) => ({
              ...c,
              tasks: c.tasks.filter((task) => task.cycleId === cycle.id),
            })),
          }
        : undefined,
    [board, cycle],
  );
  const view = useProjectTaskView({
    project: scoped,
    sourceProject: board,
    projectId,
    workspaceId,
    scope: "board",
  });
  const filtered = view.filters.filteredProject;
  const sorted = useMemo(
    () =>
      filtered && sort.field !== "position"
        ? {
            ...filtered,
            columns: filtered.columns.map((c) => ({
              ...c,
              tasks: sortTasks(c.tasks, sort),
            })),
          }
        : filtered,
    [filtered, sort],
  );
  const closeSheet = useCallback(
    () => navigate({ to: ".", search: {}, replace: true }),
    [navigate],
  );

  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      showViewSwitcher={false}
      crumb={`${t("navigation:sidebar.cycles")}${cycle ? ` › ${cycleTitle(cycle)}` : ""}`}
      toolbar={
        <ProjectToolbar
          view={view}
          display={
            <>
              <DisplaySection>
                <LayoutSwitch
                  workspaceId={workspaceId}
                  projectId={projectId}
                  currentRoute="board"
                  currentView={viewMode}
                />
              </DisplaySection>
              <TaskDisplayOptions
                projectId={projectId}
                sort={sort}
                onSortChange={setSort}
                layout={viewMode === "board" ? "cards" : "rows"}
                showBackgroundSwitch={false}
              />
            </>
          }
        />
      }
      summary={
        <TaskCount
          shown={countColumnTasks(filtered)}
          total={countColumnTasks(scoped)}
        />
      }
      filterBar={
        <ActiveFiltersBar
          subjects={view.subjects}
          onClear={view.filters.clearFilters}
          matchAny={view.filters.filters.matchAny}
          onMatchAnyChange={view.filters.setMatchAny}
          customFieldValues={view.filters.customFieldValues}
        />
      }
    >
      <PageTitle title={cycle ? cycleTitle(cycle) : undefined} />
      <div className="flex h-full min-h-0 overflow-hidden">
        <div className="flex min-w-0 flex-1 overflow-hidden">
          {cyclesLoaded && !cycle ? (
            <Empty className="min-h-[60vh] flex-1">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchXIcon />
                </EmptyMedia>
                <EmptyTitle>{t("workspace:cycles.notFound")}</EmptyTitle>
                <EmptyDescription>
                  {t("workspace:cycles.notFoundDescription")}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : sorted ? (
            viewMode === "board" ? (
              <KanbanBoard
                key={cycle?.id}
                project={sorted}
                disableCollectionActions
                disableDragDrop
              />
            ) : (
              <ListView
                key={cycle?.id}
                project={sorted}
                disableCollectionActions
                disableDragDrop
              />
            )
          ) : (
            <Skeleton className="m-4 h-10 w-full" />
          )}
        </div>
        {cycle && <CycleSidePanel cycle={cycle} board={board} />}
      </div>
      <TaskDetailsSheet
        taskId={taskId}
        projectId={projectId}
        workspaceId={workspaceId}
        onClose={closeSheet}
      />
    </ProjectLayout>
  );
}
