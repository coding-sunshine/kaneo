import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  confirmCurrentDocument,
  createTopic,
  fileDocumentOnTopic,
  makeDocumentCurrent,
  setCurrentDocumentAside,
  type TopicDocument,
} from "@/fetchers/topic/topics";
import { documentsKey } from "@/hooks/queries/document/use-documents";
import { topicsKey } from "@/hooks/queries/topic/use-topics";

export function useCreateTopic(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; projectId?: string }) =>
      createTopic({ workspaceId, ...input }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: topicsKey(workspaceId) }),
  });
}

/**
 * Filing and deciding change more than the document in hand: the topic's
 * current document, the document it replaced and every list. All of them are
 * read again.
 */
function useTopicDocumentMutation<TInput>(
  workspaceId: string,
  mutationFn: (input: TInput) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: documentsKey(workspaceId) }),
  });
}

export function useFileDocumentOnTopic(workspaceId: string) {
  return useTopicDocumentMutation(workspaceId, fileDocumentOnTopic);
}

export function useMakeDocumentCurrent(workspaceId: string) {
  return useTopicDocumentMutation(
    workspaceId,
    ({ reason, ...param }: TopicDocument & { reason: string }) =>
      makeDocumentCurrent(param, reason),
  );
}

export function useConfirmCurrentDocument(workspaceId: string) {
  return useTopicDocumentMutation(workspaceId, confirmCurrentDocument);
}

export function useSetCurrentDocumentAside(workspaceId: string) {
  return useTopicDocumentMutation(workspaceId, setCurrentDocumentAside);
}
