import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  deleteMessage,
  editMessage,
  setMessagePinned,
} from "@/fetchers/chat/messages";
import { messagesKey } from "@/hooks/queries/chat/use-messages";
import { pinsKey } from "@/hooks/queries/chat/use-pins";

// A changed message can sit in the history and in the pinned list.
function useMessageMutation<TInput, TResult>(
  workspaceId: string,
  channelId: string,
  run: (input: TInput) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: messagesKey(workspaceId, channelId),
      });
      queryClient.invalidateQueries({
        queryKey: pinsKey(workspaceId, channelId),
      });
    },
  });
}

export const useEditMessage = (workspaceId: string, channelId: string) =>
  useMessageMutation(
    workspaceId,
    channelId,
    ({ messageId, body }: { messageId: string; body: string }) =>
      editMessage({ workspaceId, channelId, messageId }, body),
  );

export const useDeleteMessage = (workspaceId: string, channelId: string) =>
  useMessageMutation(workspaceId, channelId, (messageId: string) =>
    deleteMessage({ workspaceId, channelId, messageId }),
  );

export const usePinMessage = (workspaceId: string, channelId: string) =>
  useMessageMutation(
    workspaceId,
    channelId,
    ({ messageId, pinned }: { messageId: string; pinned: boolean }) =>
      setMessagePinned({ workspaceId, channelId, messageId }, pinned),
  );
