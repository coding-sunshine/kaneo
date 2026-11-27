import { useQuery } from "@tanstack/react-query";
import { getMessages } from "@/fetchers/chat/messages";

export const messagesKey = (workspaceId: string, channelId: string) => [
  "chat-messages",
  workspaceId,
  channelId,
];

// New messages arrive over the channel socket; poll only while it is down.
const POLL_MS = 5000;

export function useMessages(
  workspaceId: string,
  channelId: string,
  enabled: boolean,
  live: boolean,
) {
  return useQuery({
    enabled,
    queryKey: messagesKey(workspaceId, channelId),
    queryFn: () => getMessages({ workspaceId, channelId }),
    refetchInterval: live ? false : POLL_MS,
    retry: false,
  });
}
