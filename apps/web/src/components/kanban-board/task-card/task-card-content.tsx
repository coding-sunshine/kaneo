import { Trash2Icon } from "lucide-react";
import { memo, type TouchEvent, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TaskPullRequests } from "@/components/task/task-pull-requests";
import { TaskRecurrenceBadge } from "@/components/task/task-recurrence-badge";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { CardFieldList } from "@/components/custom-fields/card-field-list";
import { CheckboxMark } from "@/components/custom-fields/checkbox-mark";
import { AssigneeButton } from "@/components/task-chips/assignee-button";
import { ChecklistChip } from "@/components/task-chips/checklist-chip";
import { DueDateChip } from "@/components/task-chips/due-date-chip";
import { LabelChips } from "@/components/task-chips/label-chips";
import { PriorityChip } from "@/components/task-chips/priority-chip";
import { SubtasksChip } from "@/components/task-chips/subtasks-chip";
import { taskChipClass } from "@/components/task-chips/task-chip-class";
import { useTaskCardFields } from "@/components/custom-fields/use-task-card-fields";
import { useDeleteTask } from "@/hooks/mutations/task/use-delete-task";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { cn } from "@/lib/cn";
import { isOwnDomEvent } from "@/lib/is-own-dom-event";
import { isTaskCompleted } from "@/lib/due-date-status";
import { toast } from "@/lib/toast";
import useBulkSelectionStore from "@/store/bulk-selection";
import useProjectStore from "@/store/project";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { formatDateShort } from "@/lib/format";
import { getColumnIcon } from "@/lib/column";
import type Task from "@/types/task";
import TaskCardContextMenuContent from "../task-card-context-menu/task-card-context-menu-content";
import { useTaskCardClick } from "./use-task-card-click";
import { useTouchDragMenu } from "./use-touch-drag-menu";

type TaskCardContentProps = {
  task: Task;
  disableDragDrop: boolean;
  isFinalColumn?: boolean;
  isDragging: boolean;
  onDragTouchStart?: (event: TouchEvent<HTMLDivElement>) => void;
};

function TaskCardContent({
  task,
  disableDragDrop,
  isFinalColumn,
  isDragging,
  onDragTouchStart,
}: TaskCardContentProps) {
  const { t } = useTranslation();
  const columns = useProjectStore((state) =>
    isFinalColumn === undefined ? state.project?.columns : undefined,
  );
  const projectId = useProjectStore((state) => state.project?.id);
  const projectSlug = useProjectStore((state) => state.project?.slug);
  const column = useProjectStore((state) =>
    state.project?.columns?.find((c) => c.id === task.status),
  );
  const taskIsCompleted =
    isFinalColumn ?? isTaskCompleted(task.status, columns);
  const hasPriority = Boolean(task.priority) && task.priority !== "no-priority";
  const { data: workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id ?? "";
  const { mutateAsync: deleteTask } = useDeleteTask();
  const {
    showAssignees,
    showPriority,
    showDueDates,
    showLabels,
    showTaskNumbers,
    showTaskItemCounts,
    showStatus,
    showCreatedDates,
  } = useUserPreferencesStore();

  const [isDeleteTaskModalOpen, setIsDeleteTaskModalOpen] = useState<
    boolean | null
  >(null);
  const [hasOpenedMenu, setHasOpenedMenu] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const isTaskSelected = useBulkSelectionStore((state) =>
    state.selectedTaskIds.has(task.id),
  );
  const isTaskFocused = useBulkSelectionStore(
    (state) => state.focusedTaskId === task.id,
  );
  const showIdRow = showTaskNumbers || isTaskSelected;

  const cardFields = useTaskCardFields(task.projectId, task.id);

  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(workspaceId);

  const assignee = useMemo(() => {
    return workspaceUsers?.members?.find(
      (member) => member.userId === task.userId,
    );
  }, [workspaceUsers, task.userId]);

  const { handleClick } = useTaskCardClick(task);
  const touchDragMenu = useTouchDragMenu(isDragging, onDragTouchStart);

  const handleDeleteTask = async () => {
    try {
      await deleteTask(task.id);
      toast.success(t("tasks:delete.success"), { icon: Trash2Icon });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("tasks:delete.error"),
      );
    }
  };

  return (
    <>
      <ContextMenu
        open={touchDragMenu.isMenuOpen}
        onOpenChange={(open) => {
          touchDragMenu.setIsMenuOpen(open);
          if (open) setHasOpenedMenu(true);
        }}
      >
        <ContextMenuTrigger asChild>
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- the focusable sortable wrapper owns keyboard access */}
          <div
            onClick={handleClick}
            onTouchStart={touchDragMenu.onTouchStart}
            onTouchMove={touchDragMenu.onTouchMove}
            onPointerDown={(event) => {
              if (isOwnDomEvent(event)) setIsPressed(true);
            }}
            onPointerUp={() => setIsPressed(false)}
            onPointerLeave={() => setIsPressed(false)}
            onPointerCancel={() => setIsPressed(false)}
            className={cn(
              "group relative flex flex-col rounded-[8px] border border-transparent p-[7px] transition-[background-color,border-color,box-shadow,scale] duration-150 ease-out",
              isPressed && "scale-[0.98]",
              disableDragDrop ? "cursor-default" : "cursor-move",
              taskIsCompleted
                ? "border-board-card-done-border bg-board-card-done"
                : "bg-board-card shadow-board-card hover:bg-board-card-hover",
              isDragging
                ? "border-board-card-border-hover bg-board-card shadow-[0_8px_24px_rgb(0_0_0/0.12)]"
                : null,
              isTaskSelected &&
                "border-board-card-selected-border bg-board-card-selected",
              isTaskFocused && "border-board-card-focus",
            )}
          >
            {showAssignees && (
              <div className="absolute top-[7px] right-[7px]">
                <AssigneeButton
                  task={task}
                  workspaceId={workspaceId}
                  name={assignee?.user?.name ?? task.assigneeName}
                  image={assignee?.user?.image}
                  avatarFallbackClassName={cn(
                    isTaskSelected && "bg-avatar-selected",
                    taskIsCompleted &&
                      "bg-avatar-done text-avatar-foreground-done",
                  )}
                />
              </div>
            )}
            {(showTaskNumbers || isTaskSelected) && (
              <div className="flex h-[15px] items-center gap-1.5 pr-[34px] pl-1">
                {isTaskSelected && (
                  <CheckboxMark checked className="size-3.5 shrink-0" />
                )}
                {showTaskNumbers && (
                  <span
                    className={cn(
                      "truncate font-[450] text-xs leading-[15px]",
                      taskIsCompleted ? "text-board-id-done" : "text-board-id",
                    )}
                  >
                    {projectSlug}-{task.number}
                  </span>
                )}
              </div>
            )}

            <div
              className={cn(
                "flex items-start gap-1.5 pr-[34px] pl-1",
                showIdRow && "mt-1.5",
              )}
            >
              {showStatus && (
                <span className="mt-px shrink-0 [&_svg]:size-3.5">
                  {getColumnIcon(task.status, column?.isFinal, column?.icon)}
                </span>
              )}
              <div
                className={cn(
                  "line-clamp-2 min-w-0 break-words text-[13px] leading-4",
                  taskIsCompleted
                    ? "text-board-title-done"
                    : "font-medium text-board-title",
                )}
              >
                {task.title}
              </div>
            </div>

            {!taskIsCompleted && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1 empty:hidden">
                {showPriority && hasPriority && <PriorityChip task={task} />}
                {showLabels && (
                  <LabelChips task={task} workspaceId={workspaceId} />
                )}
                <TaskPullRequests
                  externalLinks={task.externalLinks}
                  className={cn(taskChipClass, "font-normal")}
                />
                {showDueDates && <DueDateChip task={task} />}
                <TaskRecurrenceBadge task={task} />
                <SubtasksChip task={task} workspaceId={workspaceId} />
                {showTaskItemCounts && <ChecklistChip task={task} />}
                <CardFieldList
                  fields={cardFields}
                  max={2}
                  className="contents"
                />
              </div>
            )}
            {showCreatedDates && (
              <div className="mt-1.5 flex h-6 items-center text-board-id text-xs font-[450]">
                {t("settings:preferencesPage.createdDates")}{" "}
                {formatDateShort(task.createdAt)}
              </div>
            )}
          </div>
        </ContextMenuTrigger>

        {hasOpenedMenu && projectId && workspace && (
          <TaskCardContextMenuContent
            task={task}
            taskCardContext={{
              projectId,
              worskpaceId: workspace.id,
              workspaceSlug: workspace.slug,
            }}
            onDeleteClick={() => setIsDeleteTaskModalOpen(true)}
          />
        )}
      </ContextMenu>

      {isDeleteTaskModalOpen !== null && (
        <AlertDialog
          open={isDeleteTaskModalOpen}
          onOpenChange={setIsDeleteTaskModalOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("tasks:delete.title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("tasks:delete.description")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogClose render={<Button variant="outline" size="sm" />}>
                {t("common:actions.cancel")}
              </AlertDialogClose>
              <AlertDialogClose
                render={
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteTask}
                  />
                }
              >
                {t("tasks:delete.action")}
              </AlertDialogClose>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

export default memo(TaskCardContent);
