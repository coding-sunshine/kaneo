import type Task from "@/types/task";

type Team = {
  id: string;
  estimateType?: string;
  estimateCountUnestimated?: boolean;
};

const estimates = (team: Team | undefined) =>
  !!team?.estimateType && team.estimateType !== "none";

/** Points an issue adds to Insights effort: its estimate, or 1 when its team counts unestimated issues. */
export function effortWeight(teams: Team[]) {
  const byId = new Map(teams.map((team) => [team.id, team]));
  return (task: Task) => {
    const team = byId.get(task.projectId);
    if (!estimates(team)) return 0;
    return task.estimate ?? (team?.estimateCountUnestimated !== false ? 1 : 0);
  };
}

/** Linear shows Effort only when a team in the view uses estimates. */
export function viewUsesEstimates(teams: Team[], teamIds: Iterable<string>) {
  const ids = new Set(teamIds);
  return teams.some((team) => ids.has(team.id) && estimates(team));
}
