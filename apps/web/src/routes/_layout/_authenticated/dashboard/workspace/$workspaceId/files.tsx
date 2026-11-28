import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import { FileLibrary } from "@/components/file-library/file-library";
import PageTitle from "@/components/page-title";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/files",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();

  return (
    <>
      <PageTitle title={t("navigation:files.title")} />
      <WorkspaceLayout title={t("navigation:files.title")}>
        <FileLibrary workspaceId={workspaceId} />
      </WorkspaceLayout>
    </>
  );
}
