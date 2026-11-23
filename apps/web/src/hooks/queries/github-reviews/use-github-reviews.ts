import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addPullRequestComment,
  disconnectReviews,
  getPullRequest,
  getPullRequestChecks,
  getPullRequestConversation,
  getPullRequestFiles,
  getReviewsList,
  getReviewsStatus,
  type MergeMethod,
  mergePullRequest,
  type PullRef,
  type ReviewEvent,
  submitPullRequestReview,
} from "@/fetchers/github-reviews/github-reviews";

export function useReviewsStatus() {
  return useQuery({
    queryKey: ["github-reviews", "status"],
    queryFn: getReviewsStatus,
  });
}

export function useReviewsList(
  options: { includeDrafts: boolean; includeClosed: boolean },
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["github-reviews", "list", options],
    queryFn: () => getReviewsList(options),
    enabled,
  });
}

export function useDisconnectReviews() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: disconnectReviews,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["github-reviews"] }),
  });
}

const pullKey = (ref: PullRef, part: string) => [
  "github-reviews",
  "pull",
  ref.owner,
  ref.repo,
  ref.number,
  part,
];

export const usePullRequest = (ref: PullRef) =>
  useQuery({
    queryKey: pullKey(ref, "detail"),
    queryFn: () => getPullRequest(ref),
  });
export const usePullRequestFiles = (ref: PullRef, enabled: boolean) =>
  useQuery({
    queryKey: pullKey(ref, "files"),
    queryFn: () => getPullRequestFiles(ref),
    enabled,
  });
export const usePullRequestChecks = (ref: PullRef) =>
  useQuery({
    queryKey: pullKey(ref, "checks"),
    queryFn: () => getPullRequestChecks(ref),
  });
export const usePullRequestConversation = (ref: PullRef) =>
  useQuery({
    queryKey: pullKey(ref, "conversation"),
    queryFn: () => getPullRequestConversation(ref),
  });

// Every write changes the conversation, review state or merge status, so the
// pull request's queries are refetched together.
function usePullMutation<T>(
  ref: PullRef,
  mutationFn: (input: T) => Promise<void>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["github-reviews", "pull", ref.owner, ref.repo, ref.number],
      }),
  });
}

export const useSubmitReview = (ref: PullRef) =>
  usePullMutation(ref, (review: { event: ReviewEvent; body: string }) =>
    submitPullRequestReview(ref, review),
  );

export const useAddPullRequestComment = (ref: PullRef) =>
  usePullMutation(ref, (body: string) => addPullRequestComment(ref, body));

export const useMergePullRequest = (ref: PullRef) =>
  usePullMutation(ref, (method: MergeMethod) => mergePullRequest(ref, method));
