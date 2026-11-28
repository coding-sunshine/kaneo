import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getSemanticSearchSetting,
  setSemanticSearchSetting,
} from "@/fetchers/semantic-search/semantic-search";

const key = (workspaceId: string) => ["semantic-search-setting", workspaceId];

export function useSemanticSearchSetting(workspaceId: string) {
  return useQuery({
    enabled: Boolean(workspaceId),
    queryKey: key(workspaceId),
    queryFn: () => getSemanticSearchSetting(workspaceId),
    retry: false,
  });
}

export function useSetSemanticSearchSetting(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) =>
      setSemanticSearchSetting(workspaceId, enabled),
    onSuccess: (data) => queryClient.setQueryData(key(workspaceId), data),
  });
}
