import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  disconnectReviews,
  getPullRequest,
  getPullRequestChecks,
  getPullRequestConversation,
  getPullRequestFiles,
  getReviewsList,
  getReviewsStatus,
  type PullRef,
  type ReviewEvent,
  submitPullRequestReview,
} from "@/fetchers/github-reviews/github-reviews";

export function useReviewsStatus(enabled = true) {
  return useQuery({
    queryKey: ["github-reviews", "status"],
    queryFn: getReviewsStatus,
    enabled,
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

export function useSubmitReview(ref: PullRef) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (review: { event: ReviewEvent; body: string }) =>
      submitPullRequestReview(ref, review),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["github-reviews", "pull", ref.owner, ref.repo, ref.number],
      }),
  });
}
