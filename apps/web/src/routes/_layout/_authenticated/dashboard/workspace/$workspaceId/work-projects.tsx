import {
  createFileRoute,
  Link,
  Outlet,
  useMatch,
} from "@tanstack/react-router";
import { Plus, Target } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { Button, buttonVariants } from "@/components/ui/button";
import { CreateWorkProjectModal } from "@/components/work-project/create-work-project-modal";
import { WorkProjectList } from "@/components/work-project/work-project-list";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/work-projects",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const [creating, setCreating] = useState(false);
  const { canUpdateTasks } = useWorkspacePermission();
  const detail = useMatch({
    from: "/_layout/_authenticated/dashboard/workspace/$workspaceId/work-projects/$workProjectId",
    shouldThrow: false,
  });

  return (
    <>
      <PageTitle title={t("workspace:workProject.pageTitle")} />
      <WorkspaceLayout
        title={t("workspace:workProject.pageTitle")}
        headerActions={
          detail ? undefined : (
            <>
              <Link
                to="/dashboard/workspace/$workspaceId/initiatives"
                params={{ workspaceId }}
                className={buttonVariants({ size: "sm", variant: "ghost" })}
              >
                <Target />
                {t("workspace:initiative.pageTitle")}
              </Link>
              {canUpdateTasks() && (
                <Button size="sm" onClick={() => setCreating(true)}>
                  <Plus />
                  {t("workspace:workProject.newProject")}
                </Button>
              )}
            </>
          )
        }
      >
        {detail ? <Outlet /> : <WorkProjectList workspaceId={workspaceId} />}
      </WorkspaceLayout>
      <CreateWorkProjectModal
        open={creating}
        onClose={() => setCreating(false)}
        workspaceId={workspaceId}
      />
    </>
  );
}
