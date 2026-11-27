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
import { WorkProjectTimeline } from "@/components/work-project/work-project-timeline";
import { WorkProjectList } from "@/components/work-project/work-project-list";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

const VIEWS = ["list", "timeline"] as const;
const VIEW_LABELS = {
  list: "workspace:workProject.views.list",
  timeline: "workspace:workProject.views.timeline",
} as const;

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/work-projects",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<(typeof VIEWS)[number]>("list");
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
              <div role="tablist" className="flex gap-1">
                {VIEWS.map((id) => (
                  <Button
                    key={id}
                    size="sm"
                    role="tab"
                    aria-selected={view === id}
                    variant={view === id ? "secondary" : "ghost"}
                    onClick={() => setView(id)}
                  >
                    {t(VIEW_LABELS[id])}
                  </Button>
                ))}
              </div>
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
        {detail ? (
          <Outlet />
        ) : view === "timeline" ? (
          <WorkProjectTimeline workspaceId={workspaceId} />
        ) : (
          <WorkProjectList workspaceId={workspaceId} />
        )}
      </WorkspaceLayout>
      <CreateWorkProjectModal
        open={creating}
        onClose={() => setCreating(false)}
        workspaceId={workspaceId}
      />
    </>
  );
}
