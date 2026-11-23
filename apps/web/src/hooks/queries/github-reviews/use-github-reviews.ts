import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import createExternalLink from "@/fetchers/external-link/create-external-link";
import deleteExternalLink from "@/fetchers/external-link/delete-external-link";
import {
  addPullRequestComment,
  closePullRequest,
  convertPullRequestToDraft,
  getRepoLabels,
  setPullRequestLabels,
  type ClosedWindow,
  disconnectReviews,
  comparePullRequestCommits,
  getPullRequest,
  getPullRequestCommits,
  getPullRequestFileContent,
  getPullRequestChecks,
  getPullRequestConversation,
  getPullRequestFiles,
  getReviewerCandidates,
  markPullRequestReady,
  getReviewsList,
  getReviewsStatus,
  type MergeMethod,
  mergePullRequest,
  type PullRef,
  requestPullRequestReviewers,
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

export function useReviewsList(closed: ClosedWindow, enabled: boolean) {
  return useQuery({
    queryKey: ["github-reviews", "list", closed],
    queryFn: () => getReviewsList(closed),
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
export const usePullRequestCommits = (ref: PullRef, enabled: boolean) =>
  useQuery({
    queryKey: pullKey(ref, "commits"),
    queryFn: () => getPullRequestCommits(ref),
    enabled,
  });
export const useComparedFiles = (
  ref: PullRef,
  range: { base: string; head: string } | null,
) =>
  useQuery({
    queryKey: pullKey(ref, `compare-${range?.base}-${range?.head}`),
    queryFn: () => comparePullRequestCommits(ref, range!.base, range!.head),
    enabled: range !== null,
  });
// A file's text at a commit never changes, so it is fetched once.
export const useFileContent = (
  ref: PullRef,
  path: string,
  sha: string | undefined,
  enabled: boolean,
) =>
  useQuery({
    queryKey: pullKey(ref, `content-${sha}-${path}`),
    queryFn: () => getPullRequestFileContent(ref, path, sha!),
    enabled: enabled && !!sha,
    staleTime: Number.POSITIVE_INFINITY,
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

export const useReviewerCandidates = (ref: PullRef, enabled: boolean) =>
  useQuery({
    queryKey: pullKey(ref, "reviewer-candidates"),
    queryFn: () => getReviewerCandidates(ref),
    enabled,
    staleTime: 5 * 60_000,
  });

export const useRepoLabels = (ref: PullRef, enabled: boolean) =>
  useQuery({
    queryKey: ["github-reviews", "labels", ref.owner, ref.repo],
    queryFn: () => getRepoLabels(ref),
    enabled,
    staleTime: 5 * 60_000,
  });

// Every write changes the conversation, review state or merge status, so the
// pull request's queries and the reviews list are refetched together.
function usePullMutation<T>(
  ref: PullRef,
  mutationFn: (input: T) => Promise<void>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["github-reviews", "pull", ref.owner, ref.repo, ref.number],
        }),
        queryClient.invalidateQueries({ queryKey: ["github-reviews", "list"] }),
      ]),
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

export const useRequestReviewers = (ref: PullRef) =>
  usePullMutation(ref, (reviewers: string[]) =>
    requestPullRequestReviewers(ref, reviewers),
  );

export const useConvertToDraft = (ref: PullRef) =>
  usePullMutation(ref, () => convertPullRequestToDraft(ref));

export const useClosePullRequest = (ref: PullRef) =>
  usePullMutation(ref, () => closePullRequest(ref));

export const useSetPullRequestLabels = (ref: PullRef) =>
  usePullMutation(ref, (labels: string[]) => setPullRequestLabels(ref, labels));

export const useMarkPullRequestReady = (ref: PullRef) =>
  usePullMutation(ref, () => markPullRequestReady(ref));

// Linking goes through the task's external link API, so the task's own
// permission check applies. The pull request's status travels with the link.
export function useLinkPullRequestIssue(ref: PullRef) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      url,
      status,
    }: {
      taskId: string;
      url: string;
      status: "draft" | "open" | "merged" | "closed";
    }) =>
      createExternalLink({
        taskId,
        url,
        resourceType: "pull_request",
        metadata: {
          state: status === "open" || status === "draft" ? "open" : "closed",
          merged: status === "merged",
          draft: status === "draft",
        },
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: pullKey(ref, "detail"),
      }),
  });
}

export function useUnlinkPullRequestIssue(ref: PullRef) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteExternalLink,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: pullKey(ref, "detail"),
      }),
  });
}
