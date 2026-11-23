import type { ReviewItem } from "@/lib/reviews-view";

/** Linear's Merge status values; GitHub states with no Linear name never match. */
export const MERGE_STATUSES = ["ready", "blocked", "behind", "queued"] as const;

export type ReviewFilterId = "hasConflicts" | "mergeStatus" | "approvedBy";
export type ReviewFilter = { values: string[]; negated: boolean };
export type ReviewsFilters = Partial<Record<ReviewFilterId, ReviewFilter>>;

const matchers: Record<
  ReviewFilterId,
  (pr: ReviewItem, values: string[]) => boolean
> = {
  hasConflicts: (pr) => pr.hasConflicts,
  mergeStatus: (pr, values) => values.includes(pr.mergeState),
  approvedBy: (pr, values) =>
    pr.approvedBy.some((login) => values.includes(login)),
};

export function filterByReviewFilters(
  items: ReviewItem[],
  filters: ReviewsFilters,
) {
  const active = (
    Object.entries(filters) as [ReviewFilterId, ReviewFilter][]
  ).filter(([, filter]) => filter.values.length > 0);
  if (active.length === 0) return items;
  return items.filter((pr) =>
    active.every(
      ([id, filter]) => matchers[id](pr, filter.values) !== filter.negated,
    ),
  );
}

export const activeFilterCount = (filters: ReviewsFilters) =>
  Object.values(filters).filter((filter) => filter.values.length > 0).length;

export function toggleFilterValue(
  filters: ReviewsFilters,
  id: ReviewFilterId,
  value: string,
): ReviewsFilters {
  const current = filters[id] ?? { values: [], negated: false };
  const values = current.values.includes(value)
    ? current.values.filter((entry) => entry !== value)
    : [...current.values, value];
  return { ...filters, [id]: { ...current, values } };
}

export function setFilterNegated(
  filters: ReviewsFilters,
  id: ReviewFilterId,
  negated: boolean,
): ReviewsFilters {
  return { ...filters, [id]: { values: [], ...filters[id], negated } };
}

export function clearFilter(
  filters: ReviewsFilters,
  id: ReviewFilterId,
): ReviewsFilters {
  const { [id]: _removed, ...rest } = filters;
  return rest;
}

/** Everyone who approved one of these pull requests, for the Approved by choices. */
export const approverLogins = (items: ReviewItem[]) =>
  [...new Set(items.flatMap((pr) => pr.approvedBy))].sort((a, b) =>
    a.localeCompare(b),
  );
