import { useMutation, useQueryClient } from "@tanstack/react-query";
import { runChatCommand } from "@/fetchers/chat/commands";
import { messagesKey } from "@/hooks/queries/chat/use-messages";
import { OWN_PROFILE_QUERY_KEY } from "@/hooks/queries/user/use-own-profile";

/** Runs a slash command; refreshes the history and my status it may change. */
export function useRunChatCommand(workspaceId: string, channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => runChatCommand(workspaceId, channelId, text),
    onSuccess: (result) => {
      if (result.command === "ticket")
        return queryClient.invalidateQueries({
          queryKey: messagesKey(workspaceId, channelId),
        });
      if (result.command === "status")
        return Promise.all([
          queryClient.invalidateQueries({ queryKey: OWN_PROFILE_QUERY_KEY }),
          queryClient.invalidateQueries({
            queryKey: ["workspace-users", workspaceId],
          }),
        ]);
    },
  });
}
