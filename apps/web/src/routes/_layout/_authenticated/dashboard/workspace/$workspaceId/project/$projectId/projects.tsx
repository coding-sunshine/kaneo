import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { CreateWorkProjectModal } from "@/components/work-project/create-work-project-modal";
import { WorkProjectList } from "@/components/work-project/work-project-list";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/projects",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId, projectId } = Route.useParams();
  const [creating, setCreating] = useState(false);
  const { canUpdateTasks } = useWorkspacePermission();

  return (
    <>
      <PageTitle title={t("workspace:workProject.pageTitle")} />
      <ProjectLayout
        projectId={projectId}
        workspaceId={workspaceId}
        showViewSwitcher={false}
      >
        {canUpdateTasks() && (
          <div className="flex justify-end px-4 py-2">
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus />
              {t("workspace:workProject.newProject")}
            </Button>
          </div>
        )}
        <WorkProjectList workspaceId={workspaceId} teamId={projectId} />
      </ProjectLayout>
      <CreateWorkProjectModal
        open={creating}
        onClose={() => setCreating(false)}
        workspaceId={workspaceId}
        defaultTeamId={projectId}
      />
    </>
  );
}
