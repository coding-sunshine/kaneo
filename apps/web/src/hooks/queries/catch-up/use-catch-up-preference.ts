import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCatchUpPreference,
  setCatchUpPreference,
} from "@/fetchers/catch-up/catch-up";
import { toast } from "@/lib/toast";

const key = (workspaceId: string) => ["catch-up-preference", workspaceId];

export function useCatchUpPreference(workspaceId: string, enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: key(workspaceId),
    queryFn: () => getCatchUpPreference(workspaceId),
  });
}

export function useSetCatchUpPreference(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (includeDirectMessages: boolean) =>
      setCatchUpPreference(workspaceId, includeDirectMessages),
    onSuccess: (data) => queryClient.setQueryData(key(workspaceId), data),
    onError: (error) => toast.error(error.message),
  });
}
