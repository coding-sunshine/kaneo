import { useQuery } from "@tanstack/react-query";
import { getChannels } from "@/fetchers/chat/channels";

export const channelsKey = (workspaceId: string) => [
  "chat-channels",
  workspaceId,
];

/** Every channel the caller can see: public ones plus their private ones. */
export function useChannels(workspaceId: string) {
  return useQuery({
    enabled: Boolean(workspaceId),
    queryKey: channelsKey(workspaceId),
    queryFn: () => getChannels(workspaceId),
  });
}
