import { useQuery } from "@tanstack/react-query";
import { getMessages } from "@/fetchers/chat/messages";

export const messagesKey = (workspaceId: string, channelId: string) => [
  "chat-messages",
  workspaceId,
  channelId,
];

// Messages are not pushed over the socket yet, so an open channel polls.
const POLL_MS = 5000;

export function useMessages(
  workspaceId: string,
  channelId: string,
  enabled: boolean,
) {
  return useQuery({
    enabled,
    queryKey: messagesKey(workspaceId, channelId),
    queryFn: () => getMessages({ workspaceId, channelId }),
    refetchInterval: POLL_MS,
    retry: false,
  });
}
