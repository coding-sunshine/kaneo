import type { ReviewPullRequest } from "@/fetchers/github-reviews/github-reviews";

/** Linear's six Status values, in the order its Status filter and grouping list them. */
export const REVIEW_STATUSES = [
  "draft",
  "open",
  "inReview",
  "approved",
  "merged",
  "closed",
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

type StatusInput = Pick<
  ReviewPullRequest,
  "status" | "reviewDecision" | "approvedBy" | "changesRequestedBy"
>;

/**
 * The one place a pull request gets its Status value, for the filter, the
 * grouping and the ordering.
 *
 * ponytail: Linear's docs do not define In review or Approved. Inferred from
 * what Linear shows: a PR with a review requested and none submitted is Open.
 * Approved = open, not draft, review decision approved. In review = open, not
 * draft, not approved, with at least one submitted review. Swap for Linear's
 * rule if it is ever documented.
 */
export function reviewStatus(pr: StatusInput): ReviewStatus {
  if (pr.status !== "open") return pr.status;
  if (pr.reviewDecision === "approved") return "approved";
  const reviewed =
    pr.approvedBy.length > 0 ||
    pr.changesRequestedBy.length > 0 ||
    pr.reviewDecision === "changes_requested";
  return reviewed ? "inReview" : "open";
}
