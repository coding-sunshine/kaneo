import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { stopCardEvents } from "@/components/task-chips/stop-card-events";
import { taskChipClass } from "@/components/task-chips/task-chip-class";
import { useGetWorkProjects } from "@/hooks/queries/work-project/use-get-work-projects";
import { cn } from "@/lib/cn";
import { indexById } from "@/lib/work-project/index-by-id";
import { WorkProjectIcon } from "./work-project-icon";

type WorkProjectChipProps = {
  workProjectId: string | null | undefined;
  workspaceId: string;
  className?: string;
};

/** Icon-in-colour + name, shown on cards and rows when the issue has a project. */
export function WorkProjectChip({
  workProjectId,
  workspaceId,
  className,
}: WorkProjectChipProps) {
  const { data } = useGetWorkProjects(workspaceId);
  const byId = useMemo(() => indexById(data), [data]);
  const project = workProjectId ? byId.get(workProjectId) : undefined;
  if (!project) return null;

  return (
    <Link
      to="/dashboard/workspace/$workspaceId/work-projects/$workProjectId"
      params={{ workspaceId, workProjectId: project.id }}
      title={project.name}
      className={cn(taskChipClass, "max-w-36 gap-1.5", className)}
      {...stopCardEvents}
    >
      <WorkProjectIcon icon={project.icon} color={project.color} />
      <span className="truncate">{project.name}</span>
    </Link>
  );
}
