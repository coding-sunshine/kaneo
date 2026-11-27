import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addMessageToTicket } from "@/fetchers/chat/messages";

export function useAddMessageToTicket(workspaceId: string, channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      messageId,
      taskId,
    }: {
      messageId: string;
      taskId: string;
    }) => addMessageToTicket({ workspaceId, channelId, messageId }, taskId),
    onSuccess: (_comment, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: ["activities", taskId] });
      queryClient.invalidateQueries({ queryKey: ["comments", taskId] });
    },
  });
}
