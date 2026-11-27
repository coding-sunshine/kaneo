import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AssignedTaskRow } from "@/components/my-work/assigned-task-row";
import type { DueBucket } from "@/components/my-work/due-bucket";
import {
  groupAssignedTasksByActivity,
  groupAssignedTasksByDueDate,
  groupAssignedTasksByProject,
  groupAssignedTasksByStatus,
} from "@/components/my-work/group-assigned-tasks";
import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import { useLocalDay } from "@/hooks/use-local-day";
import { cn } from "@/lib/cn";
import { Link } from "@tanstack/react-router";
import { getColumnIcon } from "@/lib/column";
import { getPriorityIcon } from "@/lib/priority";
import type { MyTasksGroupBy, MyTasksLayout } from "./my-tasks-group-by";

function BoardCard({
  task,
  workspaceId,
}: {
  task: AssignedTask;
  workspaceId: string;
}) {
  return (
    <Link
      to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
      params={{ workspaceId, projectId: task.projectId, taskId: task.id }}
      className="flex flex-col gap-1.5 rounded-lg border bg-card p-3 text-[13px] outline-none hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex items-center gap-2 text-muted-foreground text-xs">
        <span className="flex [&_svg]:size-3.5">
          {getPriorityIcon(task.priority)}
        </span>
        {task.number == null
          ? task.projectSlug
          : `${task.projectSlug}-${task.number}`}
      </span>
      <span className="line-clamp-2 text-foreground">{task.title}</span>
    </Link>
  );
}

type MyTasksListProps = {
  tasks: AssignedTask[];
  total: number;
  groupBy: MyTasksGroupBy;
  activity?: boolean;
  review?: boolean;
  workspaceId: string;
  layout?: MyTasksLayout;
};

export function MyTasksList({
  tasks,
  total,
  groupBy,
  activity = false,
  review = false,
  workspaceId,
  layout = "list",
}: MyTasksListProps) {
  const { t } = useTranslation();
  const day = useLocalDay();
  const groups = useMemo(
    () =>
      activity
        ? groupAssignedTasksByActivity(tasks, new Date(day))
        : groupBy === "project"
          ? groupAssignedTasksByProject(tasks)
          : groupBy === "status"
            ? groupAssignedTasksByStatus(tasks)
            : groupAssignedTasksByDueDate(tasks, new Date(day)),
    [tasks, groupBy, activity, day],
  );

  const bucketTitles: Record<DueBucket, string> = {
    overdue: t("workspace:myWork.due.overdue"),
    today: t("workspace:myWork.due.today"),
    thisWeek: t("workspace:myWork.due.thisWeek"),
    later: t("workspace:myWork.due.later"),
    noDueDate: t("workspace:myWork.due.noDueDate"),
  };

  const board = layout === "board";
  return (
    <div
      className={
        board ? "flex h-full gap-2 overflow-x-auto p-3" : "flex flex-col"
      }
    >
      {groups.map((group) => (
        <section
          key={group.id}
          className={
            board
              ? "flex w-72 shrink-0 flex-col rounded-lg bg-muted/30"
              : undefined
          }
        >
          <h2
            className={cn(
              "flex h-9 items-center gap-2 text-[13px]",
              board ? "px-3" : "border-border/50 border-b bg-muted/40 px-5",
            )}
          >
            {group.status &&
              getColumnIcon(group.status, false, group.statusIcon)}
            <span
              className={cn(
                "font-semibold",
                group.bucket === "overdue"
                  ? "text-destructive-foreground"
                  : "text-foreground",
              )}
            >
              {group.bucket ? bucketTitles[group.bucket] : group.title}
            </span>
            <span className="font-normal text-muted-foreground text-xs tabular-nums">
              {group.tasks.length}
            </span>
          </h2>
          <div
            className={cn(
              "flex flex-col",
              board ? "min-h-0 gap-2 overflow-y-auto px-2 pb-2" : "px-4",
            )}
          >
            {group.tasks.map((task) =>
              board ? (
                <BoardCard
                  key={task.id}
                  task={task}
                  workspaceId={workspaceId}
                />
              ) : (
                <AssignedTaskRow
                  key={task.id}
                  task={task}
                  workspaceId={workspaceId}
                  showLabels
                  showActivity={activity}
                  showReview={review}
                />
              ),
            )}
          </div>
        </section>
      ))}
      {total > tasks.length && (
        <p className="px-5 py-3 text-muted-foreground text-xs">
          {t("workspace:myTasks.truncated", {
            shown: tasks.length,
            total,
          })}
        </p>
      )}
    </div>
  );
}
