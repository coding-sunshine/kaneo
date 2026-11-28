import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getBrief,
  getBriefPreference,
  setBriefPreference,
} from "@/fetchers/daily-brief/daily-brief";

const preferenceKey = (workspaceId: string) => [
  "daily-brief-preference",
  workspaceId,
];

export function useBriefPreference(workspaceId: string) {
  return useQuery({
    enabled: Boolean(workspaceId),
    queryKey: preferenceKey(workspaceId),
    queryFn: () => getBriefPreference(workspaceId),
  });
}

export function useSetBriefPreference(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (json: { enabled: boolean; channelIds: string[] }) =>
      setBriefPreference(workspaceId, json),
    onSuccess: (data) =>
      queryClient.setQueryData(preferenceKey(workspaceId), data),
  });
}

export function useBrief(workspaceId: string, briefId: string) {
  return useQuery({
    queryKey: ["daily-brief", workspaceId, briefId],
    queryFn: () => getBrief(workspaceId, briefId),
  });
}
