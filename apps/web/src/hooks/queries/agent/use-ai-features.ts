import { useQuery } from "@tanstack/react-query";
import { getAiFeatures } from "@/fetchers/agent/ai-features";
import { useHasAgent } from "@/hooks/queries/agent/use-agent";

export const aiFeaturesKey = (workspaceId: string) => [
  "ai-features",
  workspaceId,
];

/** Which background AI features the workspace runs; all off by default. */
export function useAiFeatures(workspaceId: string) {
  const hasAgent = useHasAgent();
  return useQuery({
    enabled: hasAgent && Boolean(workspaceId),
    queryKey: aiFeaturesKey(workspaceId),
    queryFn: () => getAiFeatures(workspaceId),
  });
}
