import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WorkProjectHealth } from "@/components/work-project/work-project-health";
import { WorkProjectIcon } from "@/components/work-project/work-project-icon";
import type { InitiativeDetail } from "@/fetchers/initiative/types";
import { useGetWorkProjects } from "@/hooks/queries/work-project/use-get-work-projects";
import { progressPercent } from "@/lib/work-project/progress";

type Props = {
  workspaceId: string;
  initiative: InitiativeDetail;
  editable: boolean;
  onChange: (workProjectIds: string[]) => void;
};

export function InitiativeProjects({
  workspaceId,
  initiative,
  editable,
  onChange,
}: Props) {
  const { t } = useTranslation();
  const { data: all = [] } = useGetWorkProjects(workspaceId);
  const ids = initiative.workProjectIds;
  const addable = all.filter((project) => !ids.includes(project.id));

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-medium text-sm">
          {t("workspace:initiative.projects.title")}
        </h2>
        {editable && addable.length > 0 && (
          <Select value="" onValueChange={(id) => id && onChange([...ids, id])}>
            <SelectTrigger
              size="sm"
              aria-label={t("workspace:initiative.projects.add")}
              className="w-48"
            >
              <SelectValue>
                {t("workspace:initiative.projects.add")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {addable.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {initiative.workProjects.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {t("workspace:initiative.projects.empty")}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {initiative.workProjects.map((project) => (
            <li
              key={project.id}
              className="flex items-center gap-3 px-3 py-2 text-[13px]"
            >
              <WorkProjectIcon icon={project.icon} color={project.color} />
              <Link
                to="/dashboard/workspace/$workspaceId/work-projects/$workProjectId"
                params={{ workspaceId, workProjectId: project.id }}
                className="min-w-0 flex-1 truncate font-medium hover:underline"
              >
                {project.name}
              </Link>
              <WorkProjectHealth health={project.health} />
              <span className="w-12 text-right text-muted-foreground tabular-nums">
                {progressPercent(project.progress)}%
              </span>
              {editable && (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t("workspace:initiative.projects.remove", {
                    name: project.name,
                  })}
                  onClick={() =>
                    onChange(ids.filter((id) => id !== project.id))
                  }
                >
                  <X />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
