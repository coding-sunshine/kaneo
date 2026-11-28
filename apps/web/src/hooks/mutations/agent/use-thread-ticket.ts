import { useMutation } from "@tanstack/react-query";
import { proposeThreadTicket } from "@/fetchers/agent/thread-ticket";

/** Drafts a ticket card from a chat thread; nothing is created yet. */
export function useThreadTicket(workspaceId: string, channelId: string) {
  return useMutation({
    mutationFn: (messageId: string) =>
      proposeThreadTicket(workspaceId, channelId, messageId),
  });
}
