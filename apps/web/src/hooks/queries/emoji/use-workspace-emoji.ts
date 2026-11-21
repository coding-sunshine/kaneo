import { useQuery } from "@tanstack/react-query";
import { getWorkspaceEmoji } from "@/fetchers/emoji/emoji";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";

export const workspaceEmojiKey = (workspaceId: string | undefined) => [
  "workspace-emoji",
  workspaceId,
];

function useWorkspaceEmoji() {
  const { data: workspace } = useActiveWorkspace();
  return useQuery({
    queryKey: workspaceEmojiKey(workspace?.id),
    enabled: Boolean(workspace?.id),
    staleTime: 60_000,
    queryFn: () => getWorkspaceEmoji(workspace?.id as string),
  });
}

export default useWorkspaceEmoji;
