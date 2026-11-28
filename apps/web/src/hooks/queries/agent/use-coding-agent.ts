import { useQuery } from "@tanstack/react-query";
import { getCodingAgent } from "@/fetchers/agent/delegation";
import { useHasAgent } from "@/hooks/queries/agent/use-agent";

/** Whether the server has a coding agent to hand tickets to. */
export function useCodingAgent(workspaceId: string) {
  const hasAgent = useHasAgent();
  return useQuery({
    enabled: hasAgent && Boolean(workspaceId),
    queryKey: ["coding-agent", workspaceId],
    queryFn: () => getCodingAgent(workspaceId),
    staleTime: 5 * 60_000,
  });
}
