import { useQuery } from "@tanstack/react-query";
import { getTaskProposals } from "@/fetchers/agent/proposals";
import { useHasAgent } from "@/hooks/queries/agent/use-agent";

export const taskProposalsKey = (workspaceId: string, taskId: string) => [
  "task-proposals",
  workspaceId,
  taskId,
];

/** The person's own proposals about a ticket, such as an AI triage card. */
export function useTaskProposals(workspaceId: string, taskId: string) {
  const hasAgent = useHasAgent();
  return useQuery({
    enabled: hasAgent && Boolean(workspaceId && taskId),
    queryKey: taskProposalsKey(workspaceId, taskId),
    queryFn: () => getTaskProposals(workspaceId, taskId),
  });
}
