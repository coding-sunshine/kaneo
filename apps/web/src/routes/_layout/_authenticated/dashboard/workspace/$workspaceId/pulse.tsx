import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { PulsePage } from "@/components/work-project/pulse-page";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/pulse",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const title = t("navigation:sidebar.pulse");

  return (
    <>
      <PageTitle title={title} />
      <WorkspaceLayout title={title}>
        <PulsePage workspaceId={workspaceId} />
      </WorkspaceLayout>
    </>
  );
}
