import { useQuery } from "@tanstack/react-query";
import getTaskStatusSpans from "@/fetchers/task/get-task-status-spans";

export function useTaskStatusSpans(taskId: string) {
  return useQuery({
    queryKey: ["task-status-spans", taskId],
    queryFn: () => getTaskStatusSpans(taskId),
    // Mounted only while the tooltip is open; the activity row behind a
    // status change lands just after the change itself.
    refetchOnMount: "always",
  });
}
