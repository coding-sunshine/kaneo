import { subDays, subMonths, subWeeks, subYears } from "date-fns";
import { parseDateQuery } from "@/components/common/date-picker/parse-date-query";
import { isQuickToReview } from "@/lib/reviews-quick";
import { reviewStatus } from "@/lib/reviews-status";
import { type ReviewItem, sizeBucket } from "@/lib/reviews-view";

/** Linear's Merge status values; GitHub states with no Linear name never match. */
export const MERGE_STATUSES = ["ready", "blocked", "behind", "queued"] as const;
export const CHECK_STATES = [
  "failure",
  "canceled",
  "pending",
  "success",
  "none",
] as const;
export const APPROVAL_COUNTS = ["none", "exactly1", "min1", "min2", "min3"];
export const DATE_PRESETS = ["1d", "3d", "1w", "1m", "3m", "6m", "1y"] as const;

/** Filter ids in the order Linear's filter menu lists them. */
export const REVIEW_FILTER_IDS = [
  "status",
  "mergeStatus",
  "checks",
  "hasConflicts",
  "size",
  "quickToReview",
  "author",
  "reviewers",
  "teamReviewers",
  "approvedBy",
  "changesRequestedBy",
  "approvals",
  "project",
  "team",
  "priority",
  "missingIssue",
  "repoOwner",
  "repoName",
  "labels",
  "content",
  "opened",
  "updated",
  "merged",
  "closed",
] as const;
export type ReviewFilterId = (typeof REVIEW_FILTER_IDS)[number];
export type ReviewFilter = { values: string[]; negated: boolean };
export type ReviewsFilters = Partial<Record<ReviewFilterId, ReviewFilter>>;

/** The signed-in GitHub login (what "Current user" means) and the clock for date presets. */
export type FilterContext = { me: string | null; now: Date };
export const ME = "@me";

const SUBTRACT = { d: subDays, w: subWeeks, m: subMonths, y: subYears };

/**
 * Past date from free text: "10 days ago", "yesterday", "2026-03-01", "march 3 2026".
 * ponytail: dates the parser would roll into the future ("march 3") are rejected; add a year.
 */
export function parseCustomDate(text: string, now: Date): Date | null {
  const value = text.trim().toLowerCase();
  const ago = value.match(
    /^(\d{1,4}) ?(d|w|m|y)(?:ays?|eeks?|onths?|ears?)? ago$/,
  );
  if (ago)
    return SUBTRACT[ago[2] as keyof typeof SUBTRACT](now, Number(ago[1]));
  if (value === "yesterday") return subDays(now, 1);
  const date = parseDateQuery(value, now, 1);
  return date && date <= now ? date : null;
}

const cutoff = (preset: string, now: Date): Date | null => {
  switch (preset) {
    case "1d":
      return subDays(now, 1);
    case "3d":
      return subDays(now, 3);
    case "1w":
      return subDays(now, 7);
    case "1m":
      return subMonths(now, 1);
    case "3m":
      return subMonths(now, 3);
    case "6m":
      return subMonths(now, 6);
    case "1y":
      return subYears(now, 1);
    default:
      return parseCustomDate(preset, now);
  }
};

/** A preset means "within the last N", as the counts in Linear's menu grow with the window. */
const within = (iso: string | null, values: string[], now: Date) =>
  !!iso &&
  values.some((v) => {
    const from = cutoff(v, now);
    return !!from && new Date(iso) >= from;
  });

const people = (logins: string[], values: string[], me: string | null) =>
  logins.some((login) =>
    values.some((v) => (v === ME ? login === me : v === login)),
  );

const approvalMatches = (count: number, value: string) =>
  value === "none"
    ? count === 0
    : value === "exactly1"
      ? count === 1
      : count >= Number(value.slice(3));

const matchers: Record<
  ReviewFilterId,
  (pr: ReviewItem, values: string[], ctx: FilterContext) => boolean
> = {
  status: (pr, values) => values.includes(reviewStatus(pr)),
  mergeStatus: (pr, values) => values.includes(pr.mergeState),
  // ponytail: GitHub's status rollup has no cancelled state, so Canceled lists but matches nothing.
  checks: (pr, values) => values.includes(pr.checks),
  hasConflicts: (pr) => pr.hasConflicts,
  size: (pr, values) => values.includes(sizeBucket(pr)),
  quickToReview: (pr, _values, { me }) => isQuickToReview(pr, me),
  author: (pr, values, { me }) =>
    people(pr.author ? [pr.author.login] : [], values, me),
  reviewers: (pr, values, { me }) =>
    people(
      pr.reviewers.map((r) => r.login),
      values,
      me,
    ),
  teamReviewers: (pr, values) =>
    pr.teamReviewers.some((slug) => values.includes(slug)),
  approvedBy: (pr, values, { me }) => people(pr.approvedBy, values, me),
  changesRequestedBy: (pr, values, { me }) =>
    people(pr.changesRequestedBy, values, me),
  approvals: (pr, values) =>
    values.some((v) => approvalMatches(pr.approvedBy.length, v)),
  project: (pr, values) => values.includes(pr.issue?.project?.name ?? ""),
  team: (pr, values) => values.includes(pr.issue?.team.name ?? ""),
  priority: (pr, values) =>
    values.includes(pr.issue?.priority ?? "no-priority"),
  missingIssue: (pr) => pr.issue === null,
  repoOwner: (pr, values) => values.includes(pr.owner),
  repoName: (pr, values) => values.includes(pr.repo),
  labels: (pr, values) =>
    pr.labels.some((label) => values.includes(label.name)),
  // The list data carries no body, so Content matches the title only.
  content: (pr, values) =>
    values.some((v) => pr.title.toLowerCase().includes(v.trim().toLowerCase())),
  opened: (pr, values, { now }) => within(pr.createdAt, values, now),
  updated: (pr, values, { now }) => within(pr.updatedAt, values, now),
  merged: (pr, values, { now }) =>
    pr.status === "merged" && within(pr.closedAt, values, now),
  closed: (pr, values, { now }) =>
    pr.status === "closed" && within(pr.closedAt, values, now),
};

export const matchesReviewFilter = (
  pr: ReviewItem,
  id: ReviewFilterId,
  values: string[],
  ctx: FilterContext,
) => matchers[id](pr, values, ctx);

/** How many pull requests one value alone would match, for the "N reviews" counts. */
export const countMatches = (
  items: ReviewItem[],
  id: ReviewFilterId,
  value: string,
  ctx: FilterContext,
) => items.filter((pr) => matchers[id](pr, [value], ctx)).length;

export function filterByReviewFilters(
  items: ReviewItem[],
  filters: ReviewsFilters,
  ctx: FilterContext,
  operator: "and" | "or" = "and",
) {
  const active = (
    Object.entries(filters) as [ReviewFilterId, ReviewFilter][]
  ).filter(([, filter]) => filter.values.length > 0);
  if (active.length === 0) return items;
  const matches = (pr: ReviewItem) => (entry: (typeof active)[number]) =>
    matchers[entry[0]](pr, entry[1].values, ctx) !== entry[1].negated;
  return items.filter((pr) =>
    operator === "or" ? active.some(matches(pr)) : active.every(matches(pr)),
  );
}

/** Saved filters can hold an id since dropped; keep what still fits. */
export function sanitizeReviewsFilters(saved: unknown): ReviewsFilters {
  if (!saved || typeof saved !== "object") return {};
  const kept: ReviewsFilters = {};
  for (const id of REVIEW_FILTER_IDS) {
    const entry = (saved as Record<string, Partial<ReviewFilter>>)[id];
    if (
      entry &&
      Array.isArray(entry.values) &&
      entry.values.every((value) => typeof value === "string")
    ) {
      kept[id] = { values: entry.values, negated: entry.negated === true };
    }
  }
  return kept;
}

export const activeFilterCount = (filters: ReviewsFilters) =>
  Object.values(filters).filter((filter) => filter.values.length > 0).length;

/** Date and Content filters hold one value; every other filter is a multi-select. */
export const SINGLE_VALUE_FILTERS: ReviewFilterId[] = [
  "content",
  "opened",
  "updated",
  "merged",
  "closed",
];

export function toggleFilterValue(
  filters: ReviewsFilters,
  id: ReviewFilterId,
  value: string,
): ReviewsFilters {
  const current = filters[id] ?? { values: [], negated: false };
  const values = current.values.includes(value)
    ? current.values.filter((entry) => entry !== value)
    : SINGLE_VALUE_FILTERS.includes(id)
      ? [value]
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
