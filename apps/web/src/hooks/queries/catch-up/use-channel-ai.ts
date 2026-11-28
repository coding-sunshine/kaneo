import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getChannelAi, setChannelAi } from "@/fetchers/catch-up/channel-ai";
import { toast } from "@/lib/toast";

const key = (workspaceId: string, channelId: string) => [
  "channel-ai",
  workspaceId,
  channelId,
];

export function useChannelAi(workspaceId: string, channelId: string) {
  return useQuery({
    queryKey: key(workspaceId, channelId),
    queryFn: () => getChannelAi(workspaceId, channelId),
  });
}

export function useSetChannelAi(workspaceId: string, channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (excluded: boolean) =>
      setChannelAi(workspaceId, channelId, excluded),
    onSuccess: (data) =>
      queryClient.setQueryData(key(workspaceId, channelId), data),
    onError: (error) => toast.error(error.message),
  });
}
