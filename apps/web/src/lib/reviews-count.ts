import type { ReviewsList } from "@/fetchers/github-reviews/github-reviews";

/** What the Reviews badge counts, as Linear's "Badge count" options. */
export type ReviewsCountOption = "requested" | "team" | "readyToMerge";

export const REVIEWS_COUNT_OPTIONS: ReviewsCountOption[] = [
  "requested",
  "team",
  "readyToMerge",
];

/**
 * Pull requests that count toward the Reviews badge.
 * ponytail: Linear does not document "Ready to merge"; this takes your own open,
 * non-draft PRs whose GitHub merge state is clean. Swap for Linear's rule if found.
 */
export function reviewsCount(
  data: Pick<ReviewsList, "toReview" | "created">,
  options: ReviewsCountOption[],
): number {
  const on = (option: ReviewsCountOption) => options.includes(option);
  return (
    data.toReview.filter((pr) => on(pr.teamRequested ? "team" : "requested"))
      .length +
    (on("readyToMerge")
      ? data.created.filter(
          (pr) => pr.status === "open" && pr.mergeState === "ready",
        ).length
      : 0)
  );
}

export const toggleCountOption = (
  options: ReviewsCountOption[],
  option: ReviewsCountOption,
) =>
  REVIEWS_COUNT_OPTIONS.filter((entry) =>
    entry === option ? !options.includes(entry) : options.includes(entry),
  );
