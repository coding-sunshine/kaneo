import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Ban, CheckCheck, Clock, Copy, InboxIcon, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import { PropertyChips } from "@/components/task/properties/property-chips";
import TaskDetailsContent from "@/components/task/task-details-content";
import {
  DuplicateDialog,
  SnoozeDialog,
} from "@/components/triage/triage-dialogs";
import { TriageRow } from "@/components/triage/triage-row";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { useCreateIssueStore } from "@/store/create-issue";
import useCreateTaskRelation from "@/hooks/mutations/task-relation/use-create-task-relation";
import { useSnoozeTask } from "@/hooks/mutations/task/use-snooze-task";
import { useUpdateTaskStatus } from "@/hooks/mutations/task/use-update-task-status";
import useGetProject from "@/hooks/queries/project/use-get-project";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import { triageTasks } from "@/lib/status-category";
import { formatDateShort } from "@/lib/format";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/triage",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId, workspaceId } = Route.useParams();
  const { taskId } = Route.useSearch();
  const navigate = useNavigate();
  const { data, isLoading } = useGetTasks(projectId);
  const { data: project } = useGetProject({ id: projectId, workspaceId });
  const { mutate: setStatus } = useUpdateTaskStatus();
  const { mutate: snooze } = useSnoozeTask(projectId);
  const { mutate: createRelation } = useCreateTaskRelation();
  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(workspaceId);
  const setCreateOpen = useCreateIssueStore((state) => state.setOpen);
  const [dialog, setDialog] = useState<{
    kind: "snooze" | "duplicate";
    task: Task;
  }>();

  const tasks = useMemo(() => (data ? triageTasks(data) : []), [data]);
  const selectedIndex = tasks.findIndex((task) => task.id === taskId);
  const selected = tasks[selectedIndex];

  const open = useCallback(
    (id: string) =>
      navigate({ to: ".", search: { taskId: id }, replace: true }),
    [navigate],
  );

  const moveTo = useCallback(
    (task: Task, status: string, message: string) => {
      setStatus(
        { ...task, status },
        { onSuccess: () => toast.success(message) },
      );
    },
    [setStatus],
  );
  const snoozeTo = (until: Date) => {
    if (!dialog) return;
    snooze(
      { taskId: dialog.task.id, snoozedUntil: until.toISOString() },
      {
        onSuccess: () =>
          toast.success(
            t("tasks:triage.snoozed", { date: formatDateShort(until) }),
          ),
      },
    );
    setDialog(undefined);
  };
  const markDuplicate = (original: Task) => {
    if (!dialog) return;
    const key = `${project?.slug}-${original.number}`;
    createRelation({
      sourceTaskId: dialog.task.id,
      targetTaskId: original.id,
      relationType: "duplicate",
    });
    moveTo(dialog.task, "canceled", t("tasks:triage.duplicated", { key }));
    setDialog(undefined);
  };
  const accept = (task: Task) =>
    moveTo(task, "backlog", t("tasks:triage.accepted"));
  const decline = (task: Task) =>
    moveTo(task, "canceled", t("tasks:triage.declined"));

  // Linear's triage keys: j/k move, 1 accept, 3 decline.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        target.closest("input, textarea, [contenteditable], [role=dialog]")
      )
        return;
      const step = event.key === "j" ? 1 : event.key === "k" ? -1 : 0;
      if (step) {
        const next = tasks[Math.max(0, selectedIndex + step)];
        if (next) open(next.id);
        return;
      }
      const current = tasks[selectedIndex];
      if (!current) return;
      if (event.key === "1") accept(current);
      else if (event.key === "3") decline(current);
      else if (event.key === "2") {
        setDialog({ kind: "duplicate", task: current });
        return;
      } else if (event.key === "h") {
        setDialog({ kind: "snooze", task: current });
        return;
      } else return;
      const after = tasks[selectedIndex + 1] ?? tasks[selectedIndex - 1];
      if (after) open(after.id);
      else navigate({ to: ".", search: {}, replace: true });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      showViewSwitcher={false}
      crumb={t("tasks:triage.title")}
      summary={
        <h1 className="flex items-center gap-2 font-medium text-[13px]">
          {t("tasks:triage.title")}
          {tasks.length > 0 && (
            <span className="font-normal text-muted-foreground text-xs tabular-nums">
              {tasks.length}
            </span>
          )}
        </h1>
      }
    >
      <PageTitle
        title={
          project ? `${project.name} / ${t("tasks:triage.title")}` : undefined
        }
      />
      <div className="flex h-full min-h-0">
        <div className="w-full shrink-0 overflow-y-auto border-border border-r py-2 md:w-[400px]">
          {isLoading && !data ? (
            <div className="flex flex-col gap-2 px-5">
              {[1, 2, 3].map((row) => (
                <Skeleton key={row} className="h-[51px] w-full" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <Empty className="min-h-[60vh]">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <InboxIcon />
                </EmptyMedia>
                <EmptyTitle>{t("tasks:triage.empty")}</EmptyTitle>
                <EmptyDescription>
                  {t("tasks:triage.emptyDescription")}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            tasks.map((task) => (
              <TriageRow
                key={task.id}
                task={task}
                slug={project?.slug}
                creator={
                  workspaceUsers?.members?.find(
                    (member) => member.userId === task.creatorId,
                  )?.user ?? undefined
                }
                selected={task.id === taskId}
                onOpen={() => open(task.id)}
              />
            ))
          )}
        </div>
        <div className="hidden min-w-0 flex-1 flex-col md:flex">
          {selected ? (
            <>
              <div className="flex h-12 shrink-0 items-center gap-2 px-6 text-[13px]">
                <span className="text-muted-foreground tabular-nums">
                  {project?.slug}-{selected.number}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {selected.title}
                </span>
                <div className="flex shrink-0 items-center gap-0.5">
                  {(
                    [
                      [
                        "1",
                        CheckCheck,
                        "triage.accept",
                        () => accept(selected),
                      ],
                      [
                        "2",
                        Copy,
                        "triage.duplicate",
                        () => setDialog({ kind: "duplicate", task: selected }),
                      ],
                      ["3", Ban, "triage.decline", () => decline(selected)],
                      [
                        "H",
                        Clock,
                        "triage.snooze",
                        () => setDialog({ kind: "snooze", task: selected }),
                      ],
                    ] as const
                  ).map(([key, Icon, label, run]) => (
                    <Button
                      key={key}
                      variant="ghost"
                      size="icon-sm"
                      title={`${t(`tasks:${label}`)} (${key})`}
                      aria-label={t(`tasks:${label}`)}
                      onClick={run}
                    >
                      <Icon />
                    </Button>
                  ))}
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <TaskDetailsContent
                  key={selected.id}
                  taskId={selected.id}
                  projectId={projectId}
                  workspaceId={workspaceId}
                  className="mx-auto max-w-3xl px-9 pt-4 pb-10"
                  properties={
                    <PropertyChips
                      taskId={selected.id}
                      projectId={projectId}
                      workspaceId={workspaceId}
                      className="pb-5"
                    />
                  }
                />
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-[13px]">
              <span>{t("tasks:triage.toTriage", { count: tasks.length })}</span>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => setCreateOpen(true)}
              >
                <Plus />
                {t("tasks:triage.create")}
              </Button>
            </div>
          )}
        </div>
      </div>
      <SnoozeDialog
        open={dialog?.kind === "snooze"}
        onOpenChange={(next) => !next && setDialog(undefined)}
        onSnooze={snoozeTo}
      />
      <DuplicateDialog
        open={dialog?.kind === "duplicate"}
        onOpenChange={(next) => !next && setDialog(undefined)}
        project={data}
        slug={project?.slug}
        excludeId={dialog?.task.id}
        onPick={markDuplicate}
      />
    </ProjectLayout>
  );
}
