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
        // The picker is closed while the dialog is open, and queries skip
        // refetch on mount, so refetch the inactive list now.
        refetchType: "all",
      }),
  });
}

export default useCreateWorkspaceEmoji;
