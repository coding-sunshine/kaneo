import {
  getPullRequestChecks,
  getPullRequestConversation,
  type PullRef,
} from "@/fetchers/github-reviews/github-reviews";

export const pullKey = (ref: PullRef, part: string) => [
  "github-reviews",
  "pull",
  ref.owner,
  ref.repo,
  ref.number,
  part,
];

export const checksQuery = (ref: PullRef) => ({
  queryKey: pullKey(ref, "checks"),
  queryFn: () => getPullRequestChecks(ref),
});

export const conversationQuery = (ref: PullRef) => ({
  queryKey: pullKey(ref, "conversation"),
  queryFn: () => getPullRequestConversation(ref),
});
