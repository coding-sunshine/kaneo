import { useQueries, useQueryClient } from "@tanstack/react-query";
import { Box } from "lucide-react";
import { useTranslation } from "react-i18next";
import ListView from "@/components/list-view";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { tasksQueryOptions } from "@/hooks/queries/task/tasks-query-options";
import { mergeBoardsForWorkProject } from "@/lib/work-project/merge-boards";
import type { ProjectWithTasks } from "@/types/project";

type Props = { workspaceId: string; workProjectId: string };

/** Issues of one project across every team's board, as a read-mostly list. */
export function WorkProjectIssues({ workspaceId, workProjectId }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: teams = [] } = useGetProjects({ workspaceId });
  const results = useQueries({
    queries: teams.map((team) => tasksQueryOptions(queryClient, team.id)),
  });
  const merged = mergeBoardsForWorkProject(
    results
      .map((r) => r.data as ProjectWithTasks | undefined)
      .filter((b): b is ProjectWithTasks => !!b),
    workProjectId,
  );

  if (!merged || merged.columns.length === 0) {
    return (
      <Empty className="min-h-[50vh]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Box />
          </EmptyMedia>
          <EmptyTitle>{t("workspace:workProject.issues.empty")}</EmptyTitle>
          <EmptyDescription>
            {t("workspace:workProject.issues.emptyDescription")}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return <ListView project={merged} disableDragDrop disableCollectionActions />;
}
