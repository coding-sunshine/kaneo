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
import {
  useAddWorkProjectDependency,
  useRemoveWorkProjectDependency,
} from "@/hooks/mutations/work-project/use-work-project-mutations";
import { useGetWorkProjects } from "@/hooks/queries/work-project/use-get-work-projects";
import { indexById } from "@/lib/work-project/index-by-id";
import { toast } from "@/lib/toast";
import { WorkProjectIcon } from "./work-project-icon";

type Props = {
  workspaceId: string;
  project: { id: string; dependsOnIds: string[]; dependentIds: string[] };
  editable: boolean;
};

export function WorkProjectDependencies({
  workspaceId,
  project,
  editable,
}: Props) {
  const { t } = useTranslation();
  const { data: all } = useGetWorkProjects(workspaceId);
  const byId = indexById(all);
  const { mutateAsync: add } = useAddWorkProjectDependency();
  const { mutateAsync: remove } = useRemoveWorkProjectDependency();
  const linked = new Set([
    project.id,
    ...project.dependsOnIds,
    ...project.dependentIds,
  ]);
  const addable = (all ?? []).filter((p) => !linked.has(p.id));
  const run = async (action: Promise<unknown>) => {
    try {
      await action;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("workspace:workProject.dependencies.error"),
      );
    }
  };

  // Each row is one link; `link` says which project waits on which.
  const rows = (ids: string[], link: (id: string) => [string, string]) =>
    ids.map((id) => {
      const other = byId.get(id);
      if (!other) return null;
      const [waiting, waitedOn] = link(id);
      return (
        <li key={id} className="flex items-center gap-2 py-1 text-[13px]">
          <WorkProjectIcon icon={other.icon} color={other.color} />
          <Link
            to="/dashboard/workspace/$workspaceId/work-projects/$workProjectId"
            params={{ workspaceId, workProjectId: id }}
            className="min-w-0 flex-1 truncate hover:underline"
          >
            {other.name}
          </Link>
          {editable && (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={t("workspace:workProject.dependencies.remove", {
                name: other.name,
              })}
              onClick={() =>
                run(remove({ id: waiting, dependsOnId: waitedOn }))
              }
            >
              <X />
            </Button>
          )}
        </li>
      );
    });

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-medium text-sm">
          {t("workspace:workProject.dependencies.title")}
        </h2>
        {editable && addable.length > 0 && (
          <Select
            value=""
            onValueChange={(id) =>
              id && run(add({ id: project.id, dependsOnId: id }))
            }
          >
            <SelectTrigger
              size="sm"
              aria-label={t("workspace:workProject.dependencies.add")}
              className="w-48"
            >
              <SelectValue>
                {t("workspace:workProject.dependencies.add")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {addable.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="text-muted-foreground text-xs">
            {t("workspace:workProject.dependencies.dependsOn")}
          </h3>
          {project.dependsOnIds.length === 0 ? (
            <p className="py-1 text-muted-foreground text-sm">
              {t("workspace:workProject.dependencies.none")}
            </p>
          ) : (
            <ul>{rows(project.dependsOnIds, (id) => [project.id, id])}</ul>
          )}
        </div>
        <div>
          <h3 className="text-muted-foreground text-xs">
            {t("workspace:workProject.dependencies.dependents")}
          </h3>
          {project.dependentIds.length === 0 ? (
            <p className="py-1 text-muted-foreground text-sm">
              {t("workspace:workProject.dependencies.none")}
            </p>
          ) : (
            <ul>{rows(project.dependentIds, (id) => [id, project.id])}</ul>
          )}
        </div>
      </div>
    </section>
  );
}
