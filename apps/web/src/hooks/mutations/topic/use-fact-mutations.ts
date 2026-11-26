import {
  addDocumentFact,
  addFactDependent,
  confirmDocumentFact,
  decideDocumentConflict,
  rejectDocumentFact,
  removeFactDependent,
} from "@/fetchers/document/facts";
import {
  clearNeedsReview,
  trackFact,
  untrackFact,
} from "@/fetchers/topic/facts";
import { useTopicDocumentMutation } from "./use-topic-mutations";

// A fact changes the document's panel, the topic's table, the work that
// relies on it and the flags, so each of these reads everything again.

export function useAddDocumentFact(workspaceId: string) {
  return useTopicDocumentMutation(workspaceId, addDocumentFact);
}

export function useConfirmDocumentFact(workspaceId: string) {
  return useTopicDocumentMutation(workspaceId, confirmDocumentFact);
}

export function useRejectDocumentFact(workspaceId: string) {
  return useTopicDocumentMutation(workspaceId, rejectDocumentFact);
}

export function useDecideDocumentConflict(workspaceId: string) {
  return useTopicDocumentMutation(workspaceId, decideDocumentConflict);
}

export function useAddFactDependent(workspaceId: string) {
  return useTopicDocumentMutation(workspaceId, addFactDependent);
}

export function useRemoveFactDependent(workspaceId: string) {
  return useTopicDocumentMutation(workspaceId, removeFactDependent);
}

export function useTrackFact(workspaceId: string) {
  return useTopicDocumentMutation(workspaceId, trackFact);
}

export function useUntrackFact(workspaceId: string) {
  return useTopicDocumentMutation(workspaceId, untrackFact);
}

export function useClearNeedsReview(workspaceId: string) {
  return useTopicDocumentMutation(workspaceId, clearNeedsReview);
}
