import type { ReviewItem, ReviewsProperty } from "@/lib/reviews-view";

/**
 * The key (under workspace:reviews.statusDetails) of the line Linear shows
 * under a row's title, or null when there is nothing to say.
 */
export function statusDetailsKey(pr: ReviewItem) {
  if (pr.status === "draft") return "draft";
  if (pr.focus === "needsReview" && pr.status === "open") {
    return "waitingForYou";
  }
  if (
    pr.status === "open" &&
    pr.reviewers.length === 0 &&
    pr.teamReviewers.length === 0
  ) {
    return "noReviewers";
  }
  return null;
}

/**
 * "acme/sigmma#706 · octo · feat → main": where the pull request lives, who
 * opened it and what it merges. #number only when the ID property is on.
 */
export function rowContext(pr: ReviewItem, properties: ReviewsProperty[]) {
  const id = properties.includes("id") ? `#${pr.number}` : "";
  return [
    `${pr.owner}/${pr.repo}${id}`,
    pr.author?.login,
    `${pr.headRef} → ${pr.baseRef}`,
  ]
    .filter(Boolean)
    .join(" · ");
}
