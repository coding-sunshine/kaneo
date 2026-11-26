import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  confirmCurrentDocument,
  createTopic,
  fileDocumentOnTopic,
  linkTaskTopic,
  makeDocumentCurrent,
  recordTopicDecision,
  setCurrentDocumentAside,
  setTopicFollowed,
  type TopicDocument,
  type TopicTask,
  unlinkTaskTopic,
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

export function useFollowTopic(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, follow }: { id: string; follow: boolean }) =>
      setTopicFollowed(workspaceId, id, follow),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: topicsKey(workspaceId) }),
  });
}

/**
 * Filing and deciding change more than the document in hand: the topic's
 * current document, the document it replaced and every list. All of them are
 * read again, also after a refusal: that mostly means this page's copy is old.
 */
export function useTopicDocumentMutation<TInput, TResult = unknown>(
  workspaceId: string,
  mutationFn: (input: TInput) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: documentsKey(workspaceId) }),
  });
}

export function useFileDocumentOnTopic(workspaceId: string) {
  return useTopicDocumentMutation(workspaceId, fileDocumentOnTopic);
}

export function useMakeDocumentCurrent(workspaceId: string) {
  return useTopicDocumentMutation(
    workspaceId,
    ({
      reason,
      contentHash,
      ...param
    }: TopicDocument & { reason: string; contentHash?: string }) =>
      makeDocumentCurrent(param, reason, contentHash),
  );
}

export function useRecordTopicDecision(workspaceId: string) {
  return useTopicDocumentMutation(
    workspaceId,
    ({
      id,
      ...json
    }: {
      id: string;
      text: string;
      reason: string;
      date: string;
    }) => recordTopicDecision({ workspaceId, id }, json),
  );
}

export function useConfirmCurrentDocument(workspaceId: string) {
  return useTopicDocumentMutation(workspaceId, confirmCurrentDocument);
}

export function useSetCurrentDocumentAside(workspaceId: string) {
  return useTopicDocumentMutation(workspaceId, setCurrentDocumentAside);
}

function useTopicTaskMutation(
  workspaceId: string,
  mutationFn: (input: TopicTask) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: topicsKey(workspaceId) }),
  });
}

export function useLinkTaskTopic(workspaceId: string) {
  return useTopicTaskMutation(workspaceId, linkTaskTopic);
}

export function useUnlinkTaskTopic(workspaceId: string) {
  return useTopicTaskMutation(workspaceId, unlinkTaskTopic);
}
