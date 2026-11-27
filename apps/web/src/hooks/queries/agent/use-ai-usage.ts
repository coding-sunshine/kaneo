import { useQuery } from "@tanstack/react-query";
import { getAiUsage } from "@/fetchers/agent/ai-usage";

export const aiUsageKey = (workspaceId: string) => ["ai-usage", workspaceId];

export function useAiUsage(workspaceId: string) {
  return useQuery({
    enabled: Boolean(workspaceId),
    queryKey: aiUsageKey(workspaceId),
    queryFn: () => getAiUsage(workspaceId),
  });
}
