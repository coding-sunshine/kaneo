import { useQuery } from "@tanstack/react-query";
import { getTaskDelegations } from "@/fetchers/agent/delegation";
import { useHasAgent } from "@/hooks/queries/agent/use-agent";

export const taskDelegationsKey = (workspaceId: string, taskId: string) => [
  "task-delegations",
  workspaceId,
  taskId,
];

/** The coding agent runs of a ticket, newest first. */
export function useTaskDelegations(workspaceId: string, taskId: string) {
  const hasAgent = useHasAgent();
  return useQuery({
    enabled: hasAgent && Boolean(workspaceId && taskId),
    queryKey: taskDelegationsKey(workspaceId, taskId),
    queryFn: () => getTaskDelegations(workspaceId, taskId),
  });
}
