import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import { CycleList } from "@/components/cycle/cycle-list";
import PageTitle from "@/components/page-title";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/cycles",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId, projectId } = Route.useParams();

  return (
    <>
      <PageTitle title={t("workspace:cycles.pageTitle")} />
      <ProjectLayout
        projectId={projectId}
        workspaceId={workspaceId}
        showViewSwitcher={false}
        crumb={t("navigation:sidebar.cycles")}
      >
        <CycleList workspaceId={workspaceId} projectId={projectId} />
      </ProjectLayout>
    </>
  );
}
