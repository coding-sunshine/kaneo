import { useQuery } from "@tanstack/react-query";
import { getTaskDrafts } from "@/fetchers/task-draft/task-drafts";

export const taskDraftsKey = (workspaceId: string) => [
  "task-drafts",
  workspaceId,
];

export function useTaskDrafts(workspaceId: string | undefined) {
  return useQuery({
    enabled: Boolean(workspaceId),
    queryKey: taskDraftsKey(workspaceId ?? ""),
    queryFn: () => getTaskDrafts(workspaceId ?? ""),
  });
}
