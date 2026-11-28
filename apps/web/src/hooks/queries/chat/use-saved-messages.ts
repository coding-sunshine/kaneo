import { useQuery } from "@tanstack/react-query";
import { getSavedMessages } from "@/fetchers/chat/later";

export const savedMessagesKey = (workspaceId: string) => [
  "chat-saved-messages",
  workspaceId,
];

/** The caller's own saved messages in the workspace, newest save first. */
export function useSavedMessages(workspaceId: string) {
  return useQuery({
    enabled: Boolean(workspaceId),
    queryKey: savedMessagesKey(workspaceId),
    queryFn: () => getSavedMessages(workspaceId),
  });
}
