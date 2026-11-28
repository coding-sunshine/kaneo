import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api/endpoints";
import { qk } from "@/lib/query";

export function usePageTree(workspaceId: string) {
  return useQuery({
    queryKey: qk.documentTree(workspaceId),
    queryFn: () => api.documentTree(workspaceId),
    enabled: !!workspaceId,
  });
}
