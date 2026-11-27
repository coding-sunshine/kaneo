import { useEffect } from "react";
import { useMarkChannelRead as useMarkReadMutation } from "@/hooks/mutations/chat/use-channel-mutations";

/**
 * Clears the channel's unread count when it opens and each time a new
 * message shows while it stays open. Only members have a count to clear.
 */
export function useMarkChannelRead(
  workspaceId: string,
  channelId: string,
  isMember: boolean,
  lastMessageId: string | undefined,
) {
  const { mutate } = useMarkReadMutation(workspaceId, channelId);
  // A new last message is the trigger to mark read again.
  useEffect(() => {
    if (isMember) mutate();
  }, [isMember, lastMessageId, mutate]);
}
