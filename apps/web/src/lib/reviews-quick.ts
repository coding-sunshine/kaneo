import type { ReviewItem } from "@/lib/reviews-view";

type Sized = Pick<
  ReviewItem,
  "status" | "additions" | "deletions" | "approvedBy" | "changesRequestedBy"
> &
  Partial<
    Pick<ReviewItem, "reviewedBy" | "generatedAdditions" | "generatedDeletions">
  > & {
    /** Lines changed in place, which GitHub counts once as added and once as removed. */
    changedLines?: number;
  };

/**
 * Linear's "Quick to review": open, not a draft, not yet reviewed by the viewer (any
 * submitted review counts, a pending one does not), and small. Linear counts added,
 * removed and changed lines apart and takes 10 lines in all, or at most 30 added, 3
 * changed and 100 removed. Generated files are left out when the list could fetch them all.
 * ponytail: the list carries GitHub's added and removed totals only, so changedLines is
 * absent there and the rule reads as at most 30 added and 100 removed.
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
  const changed = pr.changedLines ?? 0;
  const additions = Math.max(
    0,
    pr.additions - (pr.generatedAdditions ?? 0) - changed,
  );
  const deletions = Math.max(
    0,
    pr.deletions - (pr.generatedDeletions ?? 0) - changed,
  );
  return (
    additions + deletions + changed <= 10 ||
    (additions <= 30 && changed <= 3 && deletions <= 100)
  );
}
