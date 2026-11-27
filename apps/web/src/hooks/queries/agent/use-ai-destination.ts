import { useQuery } from "@tanstack/react-query";
import { getAiDestination } from "@/fetchers/agent/ai-destination";

export const aiDestinationKey = (workspaceId: string) => [
  "ai-destination",
  workspaceId,
];

export function useAiDestination(workspaceId: string) {
  return useQuery({
    enabled: Boolean(workspaceId),
    queryKey: aiDestinationKey(workspaceId),
    queryFn: () => getAiDestination(workspaceId),
  });
}
