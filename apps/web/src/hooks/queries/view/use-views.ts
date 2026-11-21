import { useQuery } from "@tanstack/react-query";
import { getViews } from "@/fetchers/view/views";

export const viewsKey = (workspaceId: string) => ["views", workspaceId];

export function useViews(workspaceId: string) {
  return useQuery({
    enabled: Boolean(workspaceId),
    queryKey: viewsKey(workspaceId),
    queryFn: () => getViews(workspaceId),
  });
}
