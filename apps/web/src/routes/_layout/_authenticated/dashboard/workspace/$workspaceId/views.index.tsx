import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { ViewList } from "@/components/views/view-list";
import { useViews } from "@/hooks/queries/view/use-views";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/views/",
)({
  component: RouteComponent,
});

// Linear's workspace Views page: every saved view the viewer can see.
function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const { data: views = [] } = useViews(workspaceId);

  return (
    <>
      <PageTitle title={t("navigation:views.pageTitle")} />
      <WorkspaceLayout title={t("navigation:views.title")}>
        <ViewList workspaceId={workspaceId} views={views} />
      </WorkspaceLayout>
    </>
  );
}
