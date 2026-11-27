import { useMutation } from "@tanstack/react-query";
import { summarizeTask } from "@/fetchers/agent/task-summary";

/** A summary is made on demand and kept only on screen; nothing is cached. */
export function useSummarizeTask(workspaceId: string, taskId: string) {
  return useMutation({
    mutationFn: () => summarizeTask(workspaceId, taskId),
  });
}
