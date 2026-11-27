import { Link } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { WorkProject } from "@/fetchers/work-project/types";
import { cn } from "@/lib/cn";
import { WorkProjectIcon } from "./work-project-icon";

type Props = {
  project: WorkProject;
  workspaceId: string;
  bar: { left: number; width: number } | null;
  // Names of the projects this one waits on and overlaps.
  conflictsWith: string[];
};

export function WorkProjectTimelineRow({
  project,
  workspaceId,
  bar,
  conflictsWith,
}: Props) {
  const { t } = useTranslation();
  const conflict = conflictsWith.length > 0;
  return (
    <li className="grid h-10 grid-cols-[14rem_1fr] items-center gap-4 border-border/40 border-b px-6 text-[13px]">
      <Link
        to="/dashboard/workspace/$workspaceId/work-projects/$workProjectId"
        params={{ workspaceId, workProjectId: project.id }}
        className="flex min-w-0 items-center gap-2 hover:underline"
      >
        <WorkProjectIcon icon={project.icon} color={project.color} />
        <span className="truncate">{project.name}</span>
      </Link>
      <div className="relative h-5">
        {bar ? (
          <div
            className={cn(
              "absolute inset-y-0 flex items-center rounded px-1",
              conflict && "ring-2 ring-destructive",
            )}
            style={{
              left: `${bar.left}%`,
              width: `${bar.width}%`,
              background: `${project.color}55`,
            }}
          >
            {conflict && (
              <TriangleAlert
                role="img"
                aria-label={t("workspace:workProject.timeline.conflict", {
                  names: conflictsWith.join(", "),
                })}
                className="size-3.5 shrink-0 text-destructive"
              />
            )}
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">
            {t("workspace:workProject.timeline.noDates")}
          </span>
        )}
      </div>
    </li>
  );
}
