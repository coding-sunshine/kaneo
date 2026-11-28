import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AssigneeAvatar } from "@/components/task/properties/assignee-avatar";
import type {
  WorkProject,
  WorkProjectStatus,
} from "@/fetchers/work-project/types";
import { formatDateShort } from "@/lib/format";
import { getPriorityIcon } from "@/lib/priority";
import { progressPercent } from "@/lib/work-project/progress";
import { workProjectPriorityKey } from "@/lib/work-project/priority";
import { WORK_PROJECT_GRID } from "./work-project-grid";
import { WorkProjectHealth } from "./work-project-health";
import { WorkProjectIcon } from "./work-project-icon";
import { WorkProjectStatusIcon } from "./work-project-status-icon";

const DAY = 86_400_000;

type Lead = { name?: string | null; image?: string | null } | undefined;

type WorkProjectRowProps = {
  project: WorkProject;
  workspaceId: string;
  lead: Lead;
};

export function WorkProjectRow({
  project,
  workspaceId,
  lead,
}: WorkProjectRowProps) {
  const { t } = useTranslation();
  const percent = progressPercent(project.progress);
  const milestone = project.nextMilestone;

  return (
    <Link
      to="/dashboard/workspace/$workspaceId/work-projects/$workProjectId"
      params={{ workspaceId, workProjectId: project.id }}
      className={`${WORK_PROJECT_GRID} h-12 border-border/40 border-b text-[13px] outline-none transition-colors hover:bg-accent/50 focus-visible:bg-accent/50`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <WorkProjectIcon
          icon={project.icon}
          color={project.color}
          className="size-4"
        />
        <span className="truncate font-medium text-foreground">
          {project.name}
        </span>
      </span>
      <WorkProjectHealth health={project.health} />
      <span className="flex [&_svg]:size-3.5">
        {getPriorityIcon(workProjectPriorityKey(project.priority))}
      </span>
      <span className="flex">
        {project.leadId && (
          <span title={lead?.name ?? t("workspace:workProject.noLead")}>
            <AssigneeAvatar
              name={lead?.name}
              image={lead?.image}
              assigned
              className="size-5"
            />
          </span>
        )}
      </span>
      <span className="text-muted-foreground text-xs">
        {project.targetDate ? formatDateShort(project.targetDate) : ""}
      </span>
      <span
        data-testid="work-project-update-age"
        className="text-muted-foreground text-xs tabular-nums"
      >
        {project.lastUpdateAt
          ? t("workspace:workProject.updateAge", {
              count: Math.floor(
                (Date.now() - Date.parse(project.lastUpdateAt)) / DAY,
              ),
            })
          : ""}
      </span>
      <span
        data-testid="work-project-next-milestone"
        className="truncate text-muted-foreground text-xs"
      >
        {milestone
          ? `${milestone.name} · ${formatDateShort(milestone.targetDate)}`
          : ""}
      </span>
      <span
        data-testid="work-project-overdue"
        className="text-right text-muted-foreground tabular-nums"
      >
        {project.overdueCount}
      </span>
      <span className="text-right text-muted-foreground tabular-nums">
        {project.progress.total}
      </span>
      <span className="flex items-center gap-2 text-muted-foreground tabular-nums">
        <WorkProjectStatusIcon
          status={project.status as WorkProjectStatus}
          percent={percent}
        />
        {percent}%
      </span>
    </Link>
  );
}
