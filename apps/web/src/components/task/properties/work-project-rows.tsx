import { Box, Milestone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { WorkProjectIcon } from "@/components/work-project/work-project-icon";
import { useGetWorkProject } from "@/hooks/queries/work-project/use-get-work-project";
import { useGetWorkProjects } from "@/hooks/queries/work-project/use-get-work-projects";
import { cn } from "@/lib/cn";
import type Task from "@/types/task";
import TaskMilestonePopover from "../work-project/task-milestone-popover";
import TaskWorkProjectPopover from "../work-project/task-work-project-popover";
import { PropertyRow } from "./property-row";
import { PropertyValue } from "./property-value";

type Props = { task: Task; workspaceId: string };

/** Linear's Project row, plus Milestone once a project is set. */
export function WorkProjectRows({ task, workspaceId }: Props) {
  const { t } = useTranslation();
  const { data: projects = [] } = useGetWorkProjects(workspaceId);
  const { data: detail } = useGetWorkProject(task.workProjectId ?? "");
  const project = projects.find((item) => item.id === task.workProjectId);
  const milestone = detail?.milestones.find(
    (item) => item.id === task.workProjectMilestoneId,
  );

  return (
    <>
      <PropertyRow label={t("tasks:properties.workProject")}>
        <TaskWorkProjectPopover task={task} workspaceId={workspaceId}>
          <PropertyValue data-task-action="workProject">
            {project ? (
              <WorkProjectIcon icon={project.icon} color={project.color} />
            ) : (
              <Box className="text-muted-foreground" />
            )}
            <span
              className={cn("truncate", !project && "text-muted-foreground")}
            >
              {project?.name ?? t("tasks:properties.addWorkProject")}
            </span>
          </PropertyValue>
        </TaskWorkProjectPopover>
      </PropertyRow>
      {task.workProjectId && (
        <PropertyRow label={t("tasks:properties.milestone")}>
          <TaskMilestonePopover task={task}>
            <PropertyValue data-task-action="milestone">
              <Milestone className="text-muted-foreground" />
              <span
                className={cn(
                  "truncate",
                  !milestone && "text-muted-foreground",
                )}
              >
                {milestone?.name ?? t("tasks:properties.addMilestone")}
              </span>
            </PropertyValue>
          </TaskMilestonePopover>
        </PropertyRow>
      )}
    </>
  );
}
