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

/** "sigmma#706", "#706" or "sigmma", by which of Repository and ID are on. */
export function repoRef(pr: ReviewItem, properties: ReviewsProperty[]) {
  const repo = properties.includes("repository") ? pr.repo : "";
  const id = properties.includes("id") ? `#${pr.number}` : "";
  return `${repo}${id}`;
}

/** More than the title line: Linear adds a second line for these properties. */
export const hasSecondLine = (properties: ReviewsProperty[]) =>
  ["repository", "id", "statusDetails"].some((property) =>
    properties.includes(property as ReviewsProperty),
  );
