import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { InboxIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
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
import { Skeleton } from "@/components/ui/skeleton";
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
  const [selectedId, setSelectedId] = useState<string>();
  const [dialog, setDialog] = useState<{
    kind: "snooze" | "duplicate";
    task: Task;
  }>();

  const tasks = useMemo(() => (data ? triageTasks(data) : []), [data]);
  const selectedIndex = tasks.findIndex((task) => task.id === selectedId);

  const open = useCallback(
    (id: string) =>
      navigate({ to: ".", search: { taskId: id }, replace: true }),
    [navigate],
  );
  const close = useCallback(
    () => navigate({ to: ".", search: {}, replace: true }),
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
        taskId ||
        target.closest("input, textarea, [contenteditable], [role=dialog]")
      )
        return;
      const step = event.key === "j" ? 1 : event.key === "k" ? -1 : 0;
      if (step) {
        const next = tasks[Math.max(0, selectedIndex + step)];
        if (next) setSelectedId(next.id);
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
      setSelectedId(
        tasks[selectedIndex + 1]?.id ?? tasks[selectedIndex - 1]?.id,
      );
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      showViewSwitcher={false}
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
      <div className="h-full overflow-y-auto">
        {isLoading && !data ? (
          <div className="flex flex-col px-5">
            {[1, 2, 3].map((row) => (
              <div
                key={row}
                className="flex h-10 items-center gap-3 border-border/50 border-b"
              >
                <Skeleton className="size-4 rounded-full" />
                <Skeleton className="h-3.5 w-14" />
                <Skeleton className="h-3.5 flex-1" />
              </div>
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
              workspaceId={workspaceId}
              selected={task.id === selectedId}
              onOpen={() => open(task.id)}
              onAccept={() => accept(task)}
              onDuplicate={() => setDialog({ kind: "duplicate", task })}
              onDecline={() => decline(task)}
              onSnooze={() => setDialog({ kind: "snooze", task })}
            />
          ))
        )}
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
      <TaskDetailsSheet
        taskId={taskId}
        projectId={projectId}
        workspaceId={workspaceId}
        onClose={close}
      />
    </ProjectLayout>
  );
}
