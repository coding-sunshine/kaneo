import type { ReviewItem } from "@/lib/reviews-view";

type Sized = Pick<
  ReviewItem,
  "status" | "additions" | "deletions" | "approvedBy" | "changesRequestedBy"
>;

/**
 * Linear's "Quick to review": open, not a draft, not yet reviewed by the viewer, and small
 * (30 lines added and 100 removed at most).
 * ponytail: the list carries GitHub's line totals only. Linear counts changed lines apart
 * (at most 3, or 10 lines in all, which these totals already cover), skips generated files,
 * and counts a comment-only review as reviewed; add those when the list carries per-file
 * stats and the viewer's reviews.
 */
export function isQuickToReview(pr: Sized, me: string | null) {
  if (pr.status !== "open") return false;
  if (me && [...pr.approvedBy, ...pr.changesRequestedBy].includes(me))
    return false;
  const { additions, deletions } = pr;
  return additions <= 30 && deletions <= 100;
}
