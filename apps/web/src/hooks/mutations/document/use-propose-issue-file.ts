import { useMutation, useQueryClient } from "@tanstack/react-query";
import { proposeIssueFile } from "@/fetchers/document/issue-files";
import { documentsKey } from "@/hooks/queries/document/use-documents";
import { topicsKey } from "@/hooks/queries/topic/use-topics";

/** A proposal adds a document to a topic and marks the file as proposed. */
export function useProposeIssueFile(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assetId, topicId }: { assetId: string; topicId: string }) =>
      proposeIssueFile(workspaceId, assetId, topicId),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: documentsKey(workspaceId) }),
        queryClient.invalidateQueries({ queryKey: topicsKey(workspaceId) }),
      ]),
  });
}
