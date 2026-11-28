import { useQuery } from "@tanstack/react-query";
import { getReplies } from "@/fetchers/chat/messages";
import { messagesKey } from "@/hooks/queries/chat/use-messages";

// Extends the channel's key, so socket and post invalidations reach it too.
export const repliesKey = (
  workspaceId: string,
  channelId: string,
  messageId: string,
) => [...messagesKey(workspaceId, channelId), "replies", messageId];

/** A message's thread replies, oldest first, while the thread is open. */
export function useReplies(
  workspaceId: string,
  channelId: string,
  messageId: string,
) {
  return useQuery({
    queryKey: repliesKey(workspaceId, channelId, messageId),
    queryFn: () => getReplies({ workspaceId, channelId, messageId }),
  });
}
