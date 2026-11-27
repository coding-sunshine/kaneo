import { useQuery } from "@tanstack/react-query";
import { getDirectMessages } from "@/fetchers/chat/direct-messages";

export const directMessagesKey = (workspaceId: string) => [
  "chat-direct-messages",
  workspaceId,
];

/** The caller's direct messages and group direct messages. */
export function useDirectMessages(workspaceId: string) {
  return useQuery({
    enabled: Boolean(workspaceId),
    queryKey: directMessagesKey(workspaceId),
    queryFn: () => getDirectMessages(workspaceId),
  });
}
