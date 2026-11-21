import {
  type UseQueryResult,
  useQueries,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo } from "react";
import { InsightsPanel } from "@/components/insights/insights-panel";
import type { Cycle } from "@/fetchers/cycle/get-cycles";
import { cyclesQueryOptions } from "@/hooks/queries/cycle/use-get-cycles";
import { tasksQueryOptions } from "@/hooks/queries/task/tasks-query-options";
import { useGroupFor } from "@/hooks/use-group-for";
import type { BoardFilters } from "@/hooks/use-task-filters";
import { applyViewFilters } from "@/lib/apply-view-filters";
import { mergeTeamIssues } from "@/lib/insights/merge-team-issues";
import type { ProjectWithTasks } from "@/types/project";

// Module-level so useQueries keeps the combined result stable between renders.
const loadedBoards = (results: UseQueryResult<ProjectWithTasks>[]) =>
  results.every((result) => result.data)
    ? results.map((result) => result.data as ProjectWithTasks)
    : undefined;
const allCycles = (results: UseQueryResult<Cycle[]>[]) =>
  results.flatMap((result) => result.data ?? []);

/** Linear's Insights for a saved view: every issue the view shows, across its teams. */
export function ViewInsights({
  workspaceId,
  teamIds,
  filters,
}: {
  workspaceId: string;
  teamIds: string[];
  filters: Partial<BoardFilters>;
}) {
  const queryClient = useQueryClient();
  const boards = useQueries({
    queries: teamIds.map((id) => tasksQueryOptions(queryClient, id)),
    combine: loadedBoards,
  });
  const cycles = useQueries({
    queries: teamIds.map((id) => cyclesQueryOptions(id)),
    combine: allCycles,
  });
  const group = useGroupFor(workspaceId, cycles);
  const project = useMemo(
    () =>
      boards &&
      mergeTeamIssues(boards.map((board) => applyViewFilters(board, filters))),
    [boards, filters],
  );
  if (!project) return null;
  return <InsightsPanel project={project} group={group} />;
}
