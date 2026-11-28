import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postMessage } from "@/fetchers/chat/messages";
import { messagesKey } from "@/hooks/queries/chat/use-messages";

// Refreshes the thread and its parent's reply count together.
export function usePostReply(
  workspaceId: string,
  channelId: string,
  parentId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      postMessage({ workspaceId, channelId }, body, parentId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: messagesKey(workspaceId, channelId),
      }),
  });
}
