import { useQuery } from "@tanstack/react-query";
import { listSkillRuns } from "@/fetchers/skill/skills";

export const skillRunsKey = (workspaceId: string) => [
  "ai-skill-runs",
  workspaceId,
];

function useSkillRuns(workspaceId: string, enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: skillRunsKey(workspaceId),
    queryFn: () => listSkillRuns(workspaceId),
    refetchOnMount: "always",
  });
}

export default useSkillRuns;
