import { useQuery } from "@tanstack/react-query";
import { getAgentDrafts } from "@/fetchers/agent/proposals";
import { useHasAgent } from "@/hooks/queries/agent/use-agent";

export const agentDraftsKey = (workspaceId: string) => [
  "agent-drafts",
  workspaceId,
];

/** Project updates the person's loops drafted, waiting for them on Pulse. */
export function useAgentDrafts(workspaceId: string) {
  const hasAgent = useHasAgent();
  return useQuery({
    enabled: hasAgent && Boolean(workspaceId),
    queryKey: agentDraftsKey(workspaceId),
    queryFn: () => getAgentDrafts(workspaceId),
    // Loops draft these on the server, so reread each time Pulse opens.
    refetchOnMount: "always",
  });
}
