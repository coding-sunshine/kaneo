import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetWorkProjects } from "@/hooks/queries/work-project/use-get-work-projects";
import { dependencyConflicts } from "@/lib/work-project/dependency-conflicts";
import { indexById } from "@/lib/work-project/index-by-id";
import { timelineSpan } from "@/lib/work-project/timeline-span";
import { WorkProjectTimelineRow } from "./work-project-timeline-row";

/** Projects on a shared date axis; a red bar starts before what it waits on ends. */
export function WorkProjectTimeline({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const { data: projects, isLoading } = useGetWorkProjects(workspaceId);

  if (isLoading)
    return (
      <div className="px-6 py-4">
        <Skeleton className="h-3.5 w-64" />
      </div>
    );
  if (!projects?.length)
    return (
      <p className="p-6 text-muted-foreground text-sm">
        {t("workspace:workProject.empty")}
      </p>
    );

  const span = timelineSpan(projects);
  const conflicts = dependencyConflicts(projects);
  const byId = indexById(projects);
  return (
    <ul className="h-full overflow-y-auto">
      {projects.map((project) => (
        <WorkProjectTimelineRow
          key={project.id}
          project={project}
          workspaceId={workspaceId}
          bar={span?.(project) ?? null}
          conflictsWith={(conflicts.get(project.id) ?? []).map(
            (id) => byId.get(id)?.name ?? "",
          )}
        />
      ))}
    </ul>
  );
}
