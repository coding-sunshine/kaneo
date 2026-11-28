import { useMutation, useQueryClient } from "@tanstack/react-query";
import { filesKey } from "@/hooks/queries/file-library/use-files";
import { messagesKey } from "@/hooks/queries/chat/use-messages";
import { uploadChatFiles } from "@/lib/upload-chat-files";

export function useSendChatFile(workspaceId: string, channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ files, body }: { files: File[]; body?: string }) =>
      uploadChatFiles({ workspaceId, channelId, files, body }),
    // A file that failed may follow ones already sent, so refresh either way.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: messagesKey(workspaceId, channelId),
        }),
        queryClient.invalidateQueries({ queryKey: filesKey(workspaceId) }),
      ]),
  });
}
