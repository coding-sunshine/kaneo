import { useQuery } from "@tanstack/react-query";
import {
  getTaskTopics,
  getTopic,
  getTopicDeciderCandidates,
  getTopics,
  getTopicTasks,
} from "@/fetchers/topic/topics";
import { getTopicTaskStatements } from "@/fetchers/topic/task-statements";
import { documentsKey } from "@/hooks/queries/document/use-documents";

/**
 * Topics sit under the documents prefix: a decision changes a topic and the
 * documents on it together, so one invalidation refreshes both.
 */
export const topicsKey = (workspaceId: string) => [
  ...documentsKey(workspaceId),
  "topics",
];

export function useTopics(workspaceId: string, enabled = true) {
  return useQuery({
    enabled: Boolean(workspaceId) && enabled,
    queryKey: topicsKey(workspaceId),
    queryFn: () => getTopics(workspaceId),
  });
}

/** One topic. Pass no id for a document that is not on a topic you can open. */
export function useTopic(workspaceId: string, id: string | null) {
  return useQuery({
    enabled: Boolean(workspaceId && id),
    queryKey: [...topicsKey(workspaceId), id],
    queryFn: () => getTopic(workspaceId, id ?? ""),
    retry: false,
  });
}

/** Topics the text names; asks nothing under three characters. */
export function useMatchingTopics(workspaceId: string, text: string) {
  return useQuery({
    enabled: Boolean(workspaceId) && text.length >= 3,
    queryKey: [...topicsKey(workspaceId), "match", text],
    queryFn: () => getTopics(workspaceId, text),
  });
}

export function useTopicTasks(workspaceId: string, id: string) {
  return useQuery({
    enabled: Boolean(workspaceId && id),
    queryKey: [...topicsKey(workspaceId), id, "tasks"],
    queryFn: () => getTopicTasks(workspaceId, id),
  });
}

export function useTaskTopics(workspaceId: string, taskId: string) {
  return useQuery({
    enabled: Boolean(workspaceId && taskId),
    queryKey: [...topicsKey(workspaceId), "task", taskId],
    queryFn: () => getTaskTopics(workspaceId, taskId),
  });
}

export function useTopicTaskStatements(workspaceId: string, id: string) {
  return useQuery({
    enabled: Boolean(workspaceId && id),
    queryKey: [...topicsKey(workspaceId), id, "task-statements"],
    queryFn: () => getTopicTaskStatements(workspaceId, id),
  });
}

/** Who may be named decider or backup. Pass no id to ask nothing. */
export function useTopicDeciderCandidates(
  workspaceId: string,
  id: string | null,
) {
  return useQuery({
    enabled: Boolean(workspaceId && id),
    queryKey: [...topicsKey(workspaceId), id, "deciders"],
    queryFn: () => getTopicDeciderCandidates(workspaceId, id ?? ""),
  });
}
