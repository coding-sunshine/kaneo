import { useQuery } from "@tanstack/react-query";
import getWorkProjects from "@/fetchers/work-project/get-work-projects";

export function useGetWorkProjects(workspaceId: string, teamId?: string) {
  return useQuery({
    enabled: Boolean(workspaceId),
    queryKey: ["work-projects", workspaceId, teamId ?? null],
    queryFn: () => getWorkProjects(workspaceId, teamId),
  });
}
