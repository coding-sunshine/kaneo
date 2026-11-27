import { useMutation, useQueryClient } from "@tanstack/react-query";
import { openDirectMessage } from "@/fetchers/chat/direct-messages";
import { directMessagesKey } from "@/hooks/queries/chat/use-direct-messages";

export function useOpenDirectMessage(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userIds: string[]) => openDirectMessage(workspaceId, userIds),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: directMessagesKey(workspaceId),
      }),
  });
}
