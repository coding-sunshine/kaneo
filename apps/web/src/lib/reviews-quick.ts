import type { ReviewItem } from "@/lib/reviews-view";

type Sized = Pick<
  ReviewItem,
  "status" | "additions" | "deletions" | "approvedBy" | "changesRequestedBy"
> &
  Partial<
    Pick<ReviewItem, "reviewedBy" | "generatedAdditions" | "generatedDeletions">
  >;

/**
 * Linear's "Quick to review": open, not a draft, not yet reviewed by the viewer (any
 * submitted review counts, a pending one does not), and small: 30 lines added and 100
 * removed at most, generated files left out when the list could fetch them all.
 * ponytail: Linear also counts changed lines apart (at most 3, or 10 lines in all, which
 * these totals already cover); the list carries GitHub's added and removed totals only.
 * The generated-file rule is the path heuristic, not the repo's .gitattributes.
 */
export function isQuickToReview(pr: Sized, me: string | null) {
  if (pr.status !== "open") return false;
  if (
    me &&
    [
      ...pr.approvedBy,
      ...pr.changesRequestedBy,
      ...(pr.reviewedBy ?? []),
    ].includes(me)
  )
    return false;
  const additions = pr.additions - (pr.generatedAdditions ?? 0);
  const deletions = pr.deletions - (pr.generatedDeletions ?? 0);
  return additions <= 30 && deletions <= 100;
}
