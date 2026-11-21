import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { listArchivedTasks } from "@/fetchers/task/task-archive";
import useUnarchiveTask from "@/hooks/mutations/task/use-unarchive-task";
import useGetProject from "@/hooks/queries/project/use-get-project";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/archive",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId, workspaceId } = Route.useParams();
  const navigate = useNavigate();
  const { canUpdateTasks } = useWorkspacePermission();
  const restore = useUnarchiveTask();
  const { data: project } = useGetProject({ id: projectId, workspaceId });
  const { data: tasks = [] } = useQuery({
    queryKey: ["archived-tasks", projectId],
    queryFn: () => listArchivedTasks(projectId),
    refetchOnMount: "always",
  });

  return (
    <>
      <PageTitle title={t("tasks:detail.archived.title")} />
      <ProjectLayout
        projectId={projectId}
        workspaceId={workspaceId}
        showViewSwitcher={false}
      >
        <div className="mx-auto flex max-w-3xl flex-col p-4">
          <h1 className="mb-3 font-medium text-lg">
            {t("tasks:detail.archived.title")}
          </h1>
          {tasks.length === 0 && (
            <p className="text-muted-foreground text-sm">
              {t("tasks:detail.archived.empty")}
            </p>
          )}
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 border-border border-b py-2 text-sm"
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                onClick={() =>
                  navigate({
                    to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
                    params: { workspaceId, projectId, taskId: task.id },
                  })
                }
              >
                <span className="shrink-0 font-mono text-muted-foreground text-xs">
                  {project?.slug}-{task.number}
                </span>
                <span className="truncate">{task.title}</span>
                <span className="shrink-0 text-muted-foreground text-xs">
                  {task.status}
                </span>
              </button>
              <span className="shrink-0 text-muted-foreground text-xs">
                {task.archivedAt
                  ? new Date(task.archivedAt).toLocaleDateString()
                  : ""}
              </span>
              {canUpdateTasks() && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={restore.isPending}
                  onClick={() => restore.mutate(task.id)}
                >
                  {t("tasks:detail.archived.restore")}
                </Button>
              )}
            </div>
          ))}
        </div>
      </ProjectLayout>
    </>
  );
}
