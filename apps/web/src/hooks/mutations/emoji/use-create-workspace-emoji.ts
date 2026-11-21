import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createWorkspaceEmoji } from "@/fetchers/emoji/emoji";
import { workspaceEmojiKey } from "@/hooks/queries/emoji/use-workspace-emoji";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";

function useCreateWorkspaceEmoji() {
  const queryClient = useQueryClient();
  const { data: workspace } = useActiveWorkspace();

  return useMutation({
    mutationFn: ({ name, file }: { name: string; file: Blob }) =>
      createWorkspaceEmoji(workspace?.id as string, name, file),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: workspaceEmojiKey(workspace?.id),
      }),
  });
}

export default useCreateWorkspaceEmoji;
