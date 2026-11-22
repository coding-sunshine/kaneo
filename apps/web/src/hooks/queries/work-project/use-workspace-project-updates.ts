import { useQuery } from "@tanstack/react-query";
import { getWorkspaceUpdates } from "@/fetchers/work-project/updates";

// Under "work-projects" so project mutations refresh the feed too.
export function useWorkspaceProjectUpdates(workspaceId: string) {
  return useQuery({
    queryKey: ["work-projects", "updates", workspaceId],
    queryFn: () => getWorkspaceUpdates(workspaceId),
  });
}
