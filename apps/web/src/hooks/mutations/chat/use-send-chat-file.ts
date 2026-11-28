import { useMutation, useQueryClient } from "@tanstack/react-query";
import { filesKey } from "@/hooks/queries/file-library/use-files";
import { messagesKey } from "@/hooks/queries/chat/use-messages";
import { uploadChatFile } from "@/lib/upload-chat-file";

export function useSendChatFile(workspaceId: string, channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, body }: { file: File; body?: string }) =>
      uploadChatFile({ workspaceId, channelId, file, body }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: messagesKey(workspaceId, channelId),
        }),
        queryClient.invalidateQueries({ queryKey: filesKey(workspaceId) }),
      ]),
  });
}
