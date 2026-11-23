import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { TaskDraftList } from "@/components/task-draft/task-draft-list";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/drafts",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();

  return (
    <>
      <PageTitle title={t("navigation:drafts.title")} />
      <WorkspaceLayout title={t("navigation:drafts.title")}>
        <TaskDraftList workspaceId={workspaceId} />
      </WorkspaceLayout>
    </>
  );
}
