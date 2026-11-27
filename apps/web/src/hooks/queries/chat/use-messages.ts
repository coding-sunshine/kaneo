import { useQuery } from "@tanstack/react-query";
import { getMessages } from "@/fetchers/chat/messages";

export const messagesKey = (workspaceId: string, channelId: string) => [
  "chat-messages",
  workspaceId,
  channelId,
];

// New messages arrive over the channel socket; poll only while it is down.
const POLL_MS = 5000;

// With `around`, the page that holds that message (a search result). Its key
// extends the channel's, so socket and post invalidations reach it too.
export function useMessages(
  workspaceId: string,
  channelId: string,
  enabled: boolean,
  live: boolean,
  around?: string,
) {
  return useQuery({
    enabled,
    queryKey: around
      ? [...messagesKey(workspaceId, channelId), { around }]
      : messagesKey(workspaceId, channelId),
    queryFn: () => getMessages({ workspaceId, channelId }, around),
    refetchInterval: live ? false : POLL_MS,
    retry: false,
  });
}
