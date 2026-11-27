import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postMessage } from "@/fetchers/chat/messages";
import { messagesKey } from "@/hooks/queries/chat/use-messages";

export function usePostMessage(workspaceId: string, channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => postMessage({ workspaceId, channelId }, body),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: messagesKey(workspaceId, channelId),
      }),
  });
}
