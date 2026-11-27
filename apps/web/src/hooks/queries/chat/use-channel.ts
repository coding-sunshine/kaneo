import { useQuery } from "@tanstack/react-query";
import { getChannel } from "@/fetchers/chat/channels";

export const channelKey = (workspaceId: string, channelId: string) => [
  "chat-channel",
  workspaceId,
  channelId,
];

export function useChannel(workspaceId: string, channelId: string) {
  return useQuery({
    queryKey: channelKey(workspaceId, channelId),
    queryFn: () => getChannel({ workspaceId, channelId }),
    retry: false,
  });
}
