import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import { LoopsPage } from "@/components/loops/loops-page";
import PageTitle from "@/components/page-title";
import { useHasAgent } from "@/hooks/queries/agent/use-agent";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/loops",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();

  if (!useHasAgent()) return null;

  return (
    <>
      <PageTitle title={t("navigation:loops.title")} />
      <WorkspaceLayout
        title={t("navigation:loops.title")}
        crumbs={<span className="text-xs">{t("navigation:loops.title")}</span>}
      >
        <LoopsPage workspaceId={workspaceId} />
      </WorkspaceLayout>
    </>
  );
}
