import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api/endpoints";
import { qk } from "@/lib/query";

/** Channels and direct messages of the workspace, and how many messages wait unread. */
export function useChatLists(workspaceId: string) {
  const channels = useQuery({
    queryKey: qk.chatChannels(workspaceId),
    queryFn: () => api.chatChannels(workspaceId),
    enabled: !!workspaceId,
  });
  const direct = useQuery({
    queryKey: [...qk.chatChannels(workspaceId), "direct"],
    queryFn: () => api.chatDirectMessages(workspaceId),
    enabled: !!workspaceId,
  });
  const unread = [...(channels.data ?? []), ...(direct.data ?? [])].reduce(
    (sum, c) => sum + c.unreadCount,
    0,
  );
  return { channels, direct, unread };
}
