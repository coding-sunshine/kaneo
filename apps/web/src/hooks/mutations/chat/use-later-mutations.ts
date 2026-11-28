import { useMutation, useQueryClient } from "@tanstack/react-query";
import { remindMessage, setMessageSaved } from "@/fetchers/chat/later";
import { savedMessagesKey } from "@/hooks/queries/chat/use-saved-messages";

type MessageParam = {
  workspaceId: string;
  channelId: string;
  messageId: string;
};

export const useRemindMessage = () =>
  useMutation({
    mutationFn: ({ remindAt, ...param }: MessageParam & { remindAt: Date }) =>
      remindMessage(param, remindAt),
  });

export function useSaveMessage(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ saved, ...param }: MessageParam & { saved: boolean }) =>
      setMessageSaved(param, saved),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: savedMessagesKey(workspaceId),
      }),
  });
}
