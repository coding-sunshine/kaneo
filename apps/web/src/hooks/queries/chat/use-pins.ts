import { useQuery } from "@tanstack/react-query";
import { getPins } from "@/fetchers/chat/messages";

export const pinsKey = (workspaceId: string, channelId: string) => [
  "chat-pins",
  workspaceId,
  channelId,
];

export function usePins(
  workspaceId: string,
  channelId: string,
  enabled: boolean,
) {
  return useQuery({
    enabled,
    queryKey: pinsKey(workspaceId, channelId),
    queryFn: () => getPins({ workspaceId, channelId }),
    retry: false,
  });
}
