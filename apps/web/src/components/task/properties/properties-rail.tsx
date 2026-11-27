import { Calendar, CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import icons from "@/constants/project-icons";
import { getColumnIcon } from "@/lib/column";
import { cn } from "@/lib/cn";
import {
  formatDateMedium,
  formatDateShort,
  formatDateTime,
} from "@/lib/format";
import { getPriorityLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";
import { TaskCustomFieldRows } from "../custom-fields/task-custom-field-rows";
import { DesignReviewSection } from "../design-review/design-review-section";
import TaskAssigneePopover from "../task-assignee-popover";
import TaskDueDatePopover from "../task-due-date-popover";
import TaskLabelsPopover from "../task-labels-popover";
import TaskMovePopover from "../task-move-popover";
import TaskPriorityPopover from "../task-priority-popover";
import { TaskRecurrenceBadge } from "../task-recurrence-badge";
import TaskRelations from "../task-relations";
import TaskStartDatePopover from "../task-start-date-popover";
import { StatusTimeTooltip } from "../status-time/status-time-tooltip";
import TaskStatusPopover from "../task-status-popover";
import { AssigneeAvatar } from "./assignee-avatar";
import { SlaChip } from "@/components/task-chips/sla-chip";
import { dueDateTextClass } from "./due-date-text-class";
import { LabelsValue } from "./labels-value";
import { RailSection } from "./rail-section";
import { PropertyRow } from "./property-row";
import { PropertyValue } from "./property-value";
import { CycleRow } from "./cycle-row";
import { EstimateRow } from "./estimate-row";
import { WorkProjectRows } from "./work-project-rows";
import { useTaskProperties } from "./use-task-properties";

type PropertiesRailProps = {
  taskId: string;
  projectId: string;
  workspaceId: string;
  className?: string;
};

export function PropertiesRail({
  taskId,
  projectId,
  workspaceId,
  className,
}: PropertiesRailProps) {
  const { t } = useTranslation();
  const { task, project, labels, status, assignee, dueStatus, canMoveTask } =
    useTaskProperties(taskId, projectId, workspaceId);

  if (!task) return null;

  const ProjectIcon =
    icons[project?.icon as keyof typeof icons] || icons.Layout;
  const projectValue = (
    <>
      <ProjectIcon className="text-muted-foreground" />
      <span className="truncate">{project?.name}</span>
    </>
  );

  return (
    <aside
      aria-label={t("tasks:properties.title")}
      className={cn("flex flex-col gap-6 px-3 pt-5 pb-6", className)}
    >
      <RailSection title={t("tasks:properties.title")}>
        <PropertyRow label={t("tasks:status.label")}>
          <TaskStatusPopover task={task}>
            <StatusTimeTooltip taskId={task.id}>
              <PropertyValue
                data-task-action="status"
                shortcutId="changeStatus"
              >
                {getColumnIcon(task.status ?? "", status.isFinal, status.icon)}
                <span className="truncate">{status.label}</span>
              </PropertyValue>
            </StatusTimeTooltip>
          </TaskStatusPopover>
        </PropertyRow>

        {task.canceledAt && (
          <PropertyRow label={t("tasks:properties.canceledAt")}>
            <time
              dateTime={task.canceledAt}
              title={formatDateTime(task.canceledAt)}
              className="flex h-7.5 min-w-0 items-center px-2 text-[13px] text-foreground"
            >
              {formatDateMedium(task.canceledAt)}
            </time>
          </PropertyRow>
        )}

        <PropertyRow label={t("tasks:properties.team")}>
          {canMoveTask ? (
            <TaskMovePopover task={task} workspaceId={workspaceId}>
              <PropertyValue data-task-action="move" shortcutId="moveToProject">
                {projectValue}
              </PropertyValue>
            </TaskMovePopover>
          ) : (
            <div className="flex h-7.5 min-w-0 items-center gap-2 px-2 text-[13px] text-foreground [&_svg]:size-3.5 [&_svg]:shrink-0">
              {projectValue}
            </div>
          )}
        </PropertyRow>

        <PropertyRow label={t("tasks:priority.label")}>
          <TaskPriorityPopover task={task}>
            <PropertyValue
              data-task-action="priority"
              shortcutId="changePriority"
            >
              {getPriorityIcon(task.priority ?? "")}
              <span className="truncate">
                {getPriorityLabel(task.priority ?? "")}
              </span>
            </PropertyValue>
          </TaskPriorityPopover>
        </PropertyRow>

        <PropertyRow label={t("tasks:assignee.label")}>
          <TaskAssigneePopover task={task} workspaceId={workspaceId}>
            <PropertyValue data-task-action="assignee" shortcutId="assignTask">
              <AssigneeAvatar
                name={assignee?.user?.name || task.assigneeName}
                image={assignee?.user?.image}
                assigned={Boolean(task.userId)}
              />
              <span
                className={cn(
                  "truncate",
                  !task.userId && "text-muted-foreground",
                )}
              >
                {assignee?.user?.name ||
                  task.assigneeName ||
                  t("tasks:popover.assignee.unassigned")}
              </span>
            </PropertyValue>
          </TaskAssigneePopover>
        </PropertyRow>

        <EstimateRow task={task} />

        <CycleRow task={task} />

        {task.startDate && (
          <PropertyRow label={t("tasks:properties.startDate")}>
            <TaskStartDatePopover task={task}>
              <PropertyValue>
                <CalendarDays className="text-muted-foreground" />
                <span className="truncate">
                  {formatDateShort(task.startDate)}
                </span>
              </PropertyValue>
            </TaskStartDatePopover>
          </PropertyRow>
        )}

        <PropertyRow label={t("tasks:dueDate.label")}>
          <TaskDueDatePopover task={task}>
            <PropertyValue
              data-task-action="dueDate"
              className={cn(dueDateTextClass[dueStatus])}
            >
              <Calendar
                className={cn(!task.dueDate && "text-muted-foreground")}
              />
              <span
                className={cn(
                  "truncate",
                  !task.dueDate && "text-muted-foreground",
                )}
              >
                {task.dueDate
                  ? formatDateShort(task.dueDate)
                  : t("tasks:dueDate.label")}
              </span>
              <TaskRecurrenceBadge task={task} asText />
            </PropertyValue>
          </TaskDueDatePopover>
        </PropertyRow>

        {task.slaDueAt && (
          <PropertyRow label={t("tasks:sla.label")}>
            <SlaChip task={task} showLabel />
          </PropertyRow>
        )}
      </RailSection>

      <RailSection title={t("tasks:properties.labels")}>
        <PropertyRow label={t("tasks:properties.labels")} align="start">
          <TaskLabelsPopover task={task} workspaceId={workspaceId}>
            <PropertyValue
              data-task-action="labels"
              shortcutId="changeLabels"
              className="h-auto min-h-7.5 py-1.25"
            >
              <LabelsValue labels={labels} />
            </PropertyValue>
          </TaskLabelsPopover>
        </PropertyRow>
      </RailSection>

      <RailSection title={t("tasks:properties.workProject")}>
        <WorkProjectRows task={task} workspaceId={workspaceId} />
      </RailSection>

      <DesignReviewSection task={task} workspaceId={workspaceId} />

      <TaskRelations
        taskId={taskId}
        projectId={projectId}
        workspaceId={workspaceId}
        layout="rail"
      />

      <TaskCustomFieldRows taskId={taskId} projectId={projectId} />
    </aside>
  );
}
