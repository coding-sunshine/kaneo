import { createFileRoute } from "@tanstack/react-router";
import { ChartColumn, PanelRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FavoriteStar } from "@/components/common/favorite-star";
import Layout from "@/components/common/layout";
import ListView from "@/components/list-view";
import PageTitle from "@/components/page-title";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ViewDetailsPanel } from "@/components/views/view-details-panel";
import { narrowToIssues } from "@/lib/insights/insight-selection";
import { useInsightsSelectionStore } from "@/store/insights-selection";
import { ViewInsights } from "@/components/views/view-insights";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import useGetProjectTaskRelations from "@/hooks/queries/task-relation/use-get-project-task-relations";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { useViews } from "@/hooks/queries/view/use-views";
import { applyViewFilters } from "@/lib/apply-view-filters";
import { cn } from "@/lib/cn";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type { BoardFilters } from "@/hooks/use-task-filters";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/views/$viewId",
)({
  component: RouteComponent,
});

function TeamIssues({
  projectId,
  filters,
}: {
  projectId: string;
  filters: Partial<BoardFilters>;
}) {
  const { data } = useGetTasks(projectId);
  const { data: relations } = useGetProjectTaskRelations(
    filters.workable ? projectId : "",
  );
  const insightIds = useInsightsSelectionStore((state) => state.ids);
  const project = useMemo(
    () =>
      data
        ? narrowToIssues(
            applyViewFilters(data, filters, undefined, relations),
            insightIds,
          )
        : undefined,
    [data, filters, relations, insightIds],
  );
  if (!project) return null;
  return <ListView project={project} />;
}

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId, viewId } = Route.useParams();
  const { data: views, isSuccess } = useViews(workspaceId);
  const { data: projects = [] } = useGetProjects({ workspaceId });
  const [panelOpen, setPanelOpen] = useState(true);
  // Insights and view details share the right sidebar; one shows at a time.
  const insightsOpen = useUserPreferencesStore((state) => state.insightsOpen);
  const setInsightsOpen = useUserPreferencesStore(
    (state) => state.setInsightsOpen,
  );
  const view = views?.find((item) => item.id === viewId);
  useShortcut("toggleInsights", () => setInsightsOpen(!insightsOpen), {
    enabled: !!view,
  });

  if (isSuccess && !view) {
    return (
      <p className="p-8 text-sm text-muted-foreground">
        {t("navigation:views.notFound")}
      </p>
    );
  }
  if (!view) return null;

  const filters = view.filters as Partial<BoardFilters>;
  const teams = view.projectId
    ? projects.filter((project) => project.id === view.projectId)
    : projects;
  const detailsOpen = panelOpen && !insightsOpen;

  return (
    <>
      <PageTitle title={view.name} />
      <Layout.Header className="h-11 px-2">
        <div className="flex w-full items-center gap-2">
          <SidebarTrigger className="-ml-1 h-7 w-7 shrink-0" />
          <div className="h-4 w-px shrink-0 bg-border/80" />
          <span className="truncate text-[13px] font-medium">{view.name}</span>
          <FavoriteStar
            workspaceId={workspaceId}
            target={{ type: "view", targetId: view.id }}
          />
          <button
            type="button"
            aria-pressed={insightsOpen}
            aria-label={t("tasks:insights.toggle")}
            title={t("tasks:insights.toggle")}
            onClick={() => setInsightsOpen(!insightsOpen)}
            className={cn(
              "ml-auto inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
              insightsOpen && "bg-accent text-foreground",
            )}
          >
            <ChartColumn className="size-4" />
          </button>
          <button
            type="button"
            aria-pressed={detailsOpen}
            aria-label={t("navigation:views.toggleDetails")}
            title={t("navigation:views.toggleDetails")}
            onClick={() => {
              setInsightsOpen(false);
              setPanelOpen(!detailsOpen);
            }}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
              detailsOpen && "bg-accent text-foreground",
            )}
          >
            <PanelRight className="size-4" />
          </button>
        </div>
      </Layout.Header>
      <Layout.Content>
        <div className="flex h-full min-h-0">
          <div className="min-w-0 flex-1 overflow-auto">
            {teams.map((team) => (
              <section key={team.id}>
                {teams.length > 1 && (
                  <h2 className="px-4 pt-3 text-xs font-medium text-muted-foreground">
                    {team.name}
                  </h2>
                )}
                <TeamIssues projectId={team.id} filters={filters} />
              </section>
            ))}
          </div>
          {insightsOpen && (
            <ViewInsights
              workspaceId={workspaceId}
              teamIds={teams.map((team) => team.id)}
              filters={filters}
            />
          )}
          {detailsOpen && (
            <ViewDetailsPanel
              view={view}
              workspaceId={workspaceId}
              teamName={teams.find((team) => team.id === view.projectId)?.name}
            />
          )}
        </div>
      </Layout.Content>
    </>
  );
}
