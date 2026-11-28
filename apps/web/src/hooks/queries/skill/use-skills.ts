import { useQuery } from "@tanstack/react-query";
import { listSkills } from "@/fetchers/skill/skills";
import { useHasAgent } from "@/hooks/queries/agent/use-agent";

export const skillsKey = (workspaceId: string) => ["ai-skills", workspaceId];

function useSkills(workspaceId: string) {
  const enabled = useHasAgent() && Boolean(workspaceId);
  return useQuery({
    enabled,
    queryKey: skillsKey(workspaceId),
    queryFn: () => listSkills(workspaceId),
  });
}

export default useSkills;
