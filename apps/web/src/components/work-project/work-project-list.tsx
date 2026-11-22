import { Box } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGetProjectLabels } from "@/hooks/queries/project-label/use-get-project-labels";
import { useGetWorkProjects } from "@/hooks/queries/work-project/use-get-work-projects";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { WORK_PROJECT_GRID } from "./work-project-grid";
import { WorkProjectRow } from "./work-project-row";

const COLUMNS = [
  "name",
  "health",
  "priority",
  "lead",
  "targetDate",
  "issues",
  "status",
] as const;

const ALL_LABELS = "all";

type WorkProjectListProps = { workspaceId: string; teamId?: string };

export function WorkProjectList({ workspaceId, teamId }: WorkProjectListProps) {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch, isFetching } = useGetWorkProjects(
    workspaceId,
    teamId,
  );
  const { data: projectLabels = [] } = useGetProjectLabels(workspaceId);
  const [labelId, setLabelId] = useState(ALL_LABELS);
  const visible =
    labelId === ALL_LABELS
      ? data
      : data?.filter((project) => project.labelIds.includes(labelId));
  const { data: users } = useGetActiveWorkspaceUsers(workspaceId);
  const leads = useMemo(
    () => new Map((users?.members ?? []).map((m) => [m.userId, m.user])),
    [users],
  );

  if (isError && !data) {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-2 p-6 text-muted-foreground text-sm"
      >
        <p>{t("workspace:workProject.loadError")}</p>
        <Button
          size="sm"
          variant="outline"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          {t("tasks:board.tryAgain")}
        </Button>
      </div>
    );
  }

  if (!isLoading && data?.length === 0) {
    return (
      <Empty className="min-h-[60vh]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Box />
          </EmptyMedia>
          <EmptyTitle>{t("workspace:workProject.empty")}</EmptyTitle>
          <EmptyDescription>
            {t("workspace:workProject.emptyDescription")}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {projectLabels.length > 0 && (
        <div className="flex h-10 items-center gap-2 border-b px-4">
          <Select
            value={labelId}
            onValueChange={(next) => setLabelId(next ?? ALL_LABELS)}
          >
            <SelectTrigger
              size="sm"
              aria-label={t("workspace:workProject.labels.filter")}
              className="w-44"
            >
              <SelectValue>
                {projectLabels.find((label) => label.id === labelId)?.name ??
                  t("workspace:workProject.labels.all")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_LABELS}>
                {t("workspace:workProject.labels.all")}
              </SelectItem>
              {projectLabels.map((label) => (
                <SelectItem key={label.id} value={label.id}>
                  {label.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div
        role="row"
        className={`${WORK_PROJECT_GRID} h-6 text-muted-foreground text-xs`}
      >
        {COLUMNS.map((column) => (
          <span
            key={column}
            className={column === "issues" ? "text-right" : undefined}
          >
            {t(`workspace:workProject.columns.${column}`)}
          </span>
        ))}
      </div>
      {isLoading
        ? [1, 2, 3].map((row) => (
            <div key={row} className="flex h-12 items-center pl-9">
              <Skeleton className="h-3.5 w-64" />
            </div>
          ))
        : visible?.map((project) => (
            <WorkProjectRow
              key={project.id}
              project={project}
              workspaceId={workspaceId}
              lead={project.leadId ? leads.get(project.leadId) : undefined}
            />
          ))}
    </div>
  );
}
