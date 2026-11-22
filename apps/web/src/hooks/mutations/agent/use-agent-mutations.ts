import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { TranscriptMessage } from "@/components/agent/agent-transcript";
import { deleteChat, streamMessage } from "@/fetchers/agent/agent";
import { agentChatKey, agentChatsKey } from "@/hooks/queries/agent/use-agent";

type Live = { messages: TranscriptMessage[]; text: string };
const idle: Live = { messages: [], text: "" };

/**
 * Sends a message and streams the reply. `live` holds what has arrived so far:
 * finished messages (tool calls and results) plus the reply text being typed.
 * It clears once the saved chat has been refetched.
 */
export function useSendMessage(workspaceId: string) {
  const queryClient = useQueryClient();
  const [live, setLive] = useState<Live>(idle);
  const mutation = useMutation({
    mutationFn: async (input: { chatId?: string; message: string }) => {
      let chatId = input.chatId;
      let failure: string | null = null;
      setLive(idle);
      await streamMessage(workspaceId, input, (event) => {
        if (event.type === "chat") chatId = event.chatId;
        else if (event.type === "delta")
          setLive((prev) => ({ ...prev, text: prev.text + event.text }));
        else if (event.type === "message")
          setLive((prev) => ({
            messages: [...prev.messages, event.message],
            text: "",
          }));
        else if (event.type === "error") failure = event.message;
      });
      if (chatId) {
        await queryClient.invalidateQueries({
          queryKey: agentChatKey(workspaceId, chatId),
        });
        await queryClient.invalidateQueries({
          queryKey: agentChatsKey(workspaceId),
        });
      }
      setLive(idle);
      if (failure) throw new Error(failure);
      return { chatId };
    },
  });
  return { ...mutation, live };
}

export function useDeleteChat(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (chatId: string) => deleteChat(workspaceId, chatId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: agentChatsKey(workspaceId) }),
  });
}
