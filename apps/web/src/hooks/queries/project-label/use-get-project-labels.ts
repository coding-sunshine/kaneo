import { useQuery } from "@tanstack/react-query";
import { getProjectLabels } from "@/fetchers/project-label/project-labels";

export function useGetProjectLabels(workspaceId: string) {
  return useQuery({
    enabled: Boolean(workspaceId),
    queryKey: ["project-labels", workspaceId],
    queryFn: () => getProjectLabels(workspaceId),
  });
}
