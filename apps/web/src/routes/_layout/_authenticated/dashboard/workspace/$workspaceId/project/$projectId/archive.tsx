import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import { getColumnIcon } from "@/lib/column";
import { getPriorityIcon } from "@/lib/priority";
import { Button } from "@/components/ui/button";
import { listArchivedTasks } from "@/fetchers/task/task-archive";
import useUnarchiveTask from "@/hooks/mutations/task/use-unarchive-task";
import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
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

  const { data: columns } = useGetColumns(projectId);
  const column = (id: string) => columns?.find((c) => c.id === id);

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
              className="flex h-9 items-center gap-3 rounded-md px-2 text-sm hover:bg-accent"
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
                <span className="flex size-5.5 shrink-0 items-center justify-center [&_svg]:size-3.5">
                  {getPriorityIcon(task.priority ?? "")}
                </span>
                <span className="w-13 shrink-0 truncate font-mono text-muted-foreground text-xs">
                  {project?.slug}-{task.number}
                </span>
                <span
                  className="flex size-5.5 shrink-0 items-center justify-center"
                  title={column(task.status)?.name ?? task.status}
                >
                  {getColumnIcon(
                    task.status,
                    column(task.status)?.isFinal,
                    column(task.status)?.icon,
                  )}
                </span>
                <span className="truncate text-foreground">{task.title}</span>
              </button>
              <span className="shrink-0 text-muted-foreground text-xs">
                {task.archivedAt
                  ? new Date(task.archivedAt).toLocaleDateString()
                  : ""}
              </span>
              {canUpdateTasks() && (
                <Button
                  size="sm"
                  variant="ghost"
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
