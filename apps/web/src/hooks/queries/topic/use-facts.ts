import { useQuery } from "@tanstack/react-query";
import {
  getDocumentFacts,
  getDocumentReceipt,
  getDocumentReliedTopics,
} from "@/fetchers/document/facts";
import {
  getNeedsReview,
  getTopicDependents,
  getTopicFacts,
  getTrackedFacts,
} from "@/fetchers/topic/facts";
import { documentsKey } from "@/hooks/queries/document/use-documents";
import { topicsKey } from "./use-topics";

// Every key sits under the documents prefix: confirming a fact, deciding a
// conflict or making a document current changes several of these at once.

/** What a document says about its topic's facts. Pass no id to ask nothing. */
export function useDocumentFacts(workspaceId: string, id: string | null) {
  return useQuery({
    enabled: Boolean(workspaceId && id),
    queryKey: [...documentsKey(workspaceId), "facts", id],
    queryFn: () => getDocumentFacts(workspaceId, id ?? ""),
  });
}

/** A document's facts sorted against what its topic states now. */
export function useDocumentReceipt(workspaceId: string, id: string | null) {
  return useQuery({
    enabled: Boolean(workspaceId && id),
    queryKey: [...documentsKey(workspaceId), "receipt", id],
    queryFn: () => getDocumentReceipt(workspaceId, id ?? ""),
  });
}

/** The topics a document relies on, for the facts panel. */
export function useDocumentReliedTopics(workspaceId: string, id: string) {
  return useQuery({
    enabled: Boolean(workspaceId && id),
    queryKey: [...documentsKey(workspaceId), "relies-on", id],
    queryFn: () => getDocumentReliedTopics(workspaceId, id),
  });
}

export function useTopicFacts(workspaceId: string, id: string | null) {
  return useQuery({
    enabled: Boolean(workspaceId && id),
    queryKey: [...topicsKey(workspaceId), id, "facts"],
    queryFn: () => getTopicFacts(workspaceId, id ?? ""),
  });
}

export function useTrackedFacts(workspaceId: string, id: string | null) {
  return useQuery({
    enabled: Boolean(workspaceId && id),
    queryKey: [...topicsKey(workspaceId), id, "tracked"],
    queryFn: () => getTrackedFacts(workspaceId, id ?? ""),
  });
}

export function useTopicDependents(workspaceId: string, id: string | null) {
  return useQuery({
    enabled: Boolean(workspaceId && id),
    queryKey: [...topicsKey(workspaceId), id, "dependents"],
    queryFn: () => getTopicDependents(workspaceId, id ?? ""),
  });
}

export function useNeedsReview(workspaceId: string, enabled = true) {
  return useQuery({
    enabled: Boolean(workspaceId) && enabled,
    queryKey: [...topicsKey(workspaceId), "needs-review"],
    queryFn: () => getNeedsReview(workspaceId),
  });
}
