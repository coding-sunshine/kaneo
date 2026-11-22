import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteChat, sendMessage } from "@/fetchers/agent/agent";
import { agentChatKey, agentChatsKey } from "@/hooks/queries/agent/use-agent";

export function useSendMessage(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { chatId?: string; message: string }) =>
      sendMessage(workspaceId, input),
    onSuccess: (reply) => {
      queryClient.setQueryData(agentChatKey(workspaceId, reply.chatId), {
        id: reply.chatId,
        title: reply.title,
        messages: reply.messages,
      });
      queryClient.invalidateQueries({ queryKey: agentChatsKey(workspaceId) });
    },
  });
}

export function useDeleteChat(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (chatId: string) => deleteChat(workspaceId, chatId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: agentChatsKey(workspaceId) }),
  });
}
