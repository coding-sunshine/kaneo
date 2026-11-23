import type { GithubSearchPull } from "./github-api";

const MERGE_STATES = {
  CLEAN: "ready",
  BLOCKED: "blocked",
  BEHIND: "behind",
  UNSTABLE: "unstable",
  DRAFT: "draft",
} as const;

/** GitHub's mergeStateStatus, folded into the states Linear's Merge status filter offers. */
export function toMergeState(pull: GithubSearchPull) {
  if (pull.mergeQueueEntry) return "queued" as const;
  return (
    MERGE_STATES[pull.mergeStateStatus as keyof typeof MERGE_STATES] ??
    ("unknown" as const)
  );
}

type Person = { login: string; avatarUrl: string };

/** People and teams asked to review, plus everyone whose latest review is an approval or a change request. */
export function toReviewFields(pull: GithubSearchPull) {
  const requests = (pull.reviewRequests?.nodes ?? []).map(
    (node) => node.requestedReviewer,
  );
  const reviews = (pull.latestOpinionatedReviews?.nodes ?? []).filter(
    (review): review is { state: string; author: Person } => !!review.author,
  );
  const people = new Map<string, Person>();
  for (const reviewer of requests) {
    if (reviewer?.__typename === "User") {
      people.set(reviewer.login, {
        login: reviewer.login,
        avatarUrl: reviewer.avatarUrl,
      });
    }
  }
  for (const { author } of reviews) people.set(author.login, author);
  const by = (state: string) =>
    reviews.filter((r) => r.state === state).map((r) => r.author.login);
  return {
    reviewers: [...people.values()],
    teamReviewers: requests.flatMap((reviewer) =>
      reviewer?.__typename === "Team" ? [reviewer.slug] : [],
    ),
    approvedBy: by("APPROVED"),
    changesRequestedBy: by("CHANGES_REQUESTED"),
  };
}
