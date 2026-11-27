import { useMutation, useQueryClient } from "@tanstack/react-query";
import { removeLinkPreview } from "@/fetchers/chat/messages";
import { messagesKey } from "@/hooks/queries/chat/use-messages";

export function useRemoveLinkPreview(workspaceId: string, channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) =>
      removeLinkPreview({ workspaceId, channelId, messageId }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: messagesKey(workspaceId, channelId),
      }),
  });
}
