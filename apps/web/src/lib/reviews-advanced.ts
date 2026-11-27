import {
  type FilterContext,
  matchesReviewFilter,
  REVIEW_FILTER_IDS,
  type ReviewFilterId,
  sanitizeReviewsFilters,
} from "@/lib/reviews-filters";
import type { ReviewItem } from "@/lib/reviews-view";

export type AdvancedOperator = "and" | "or";

export type ReviewsAdvancedCondition = {
  kind: "condition";
  id: string;
  subject: ReviewFilterId;
  values: string[];
  negated: boolean;
};

export type ReviewsAdvancedGroup = {
  kind: "group";
  id: string;
  operator: AdvancedOperator;
  conditions: ReviewsAdvancedEntry[];
};

export type ReviewsAdvancedEntry =
  | ReviewsAdvancedCondition
  | ReviewsAdvancedGroup;

/** Linear's Advanced filter: a group of conditions and nested groups, each with its own and/or. */
export type ReviewsAdvancedFilter = {
  operator: AdvancedOperator;
  conditions: ReviewsAdvancedEntry[];
};

const MAX_DEPTH = 6;
let nextFallbackId = 0;

export function createAdvancedId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  nextFallbackId += 1;
  return `adv-${nextFallbackId}`;
}

export function countAdvancedConditions(group: ReviewsAdvancedFilter): number {
  let count = 0;
  for (const entry of group.conditions) {
    if (entry.kind === "condition") {
      if (entry.values.length > 0) count += 1;
    } else {
      count += countAdvancedConditions(entry);
    }
  }
  return count;
}

function isActiveEntry(entry: ReviewsAdvancedEntry): boolean {
  return entry.kind === "condition"
    ? entry.values.length > 0
    : entry.conditions.some(isActiveEntry);
}

function matchesEntry(
  pr: ReviewItem,
  entry: ReviewsAdvancedEntry,
  ctx: FilterContext,
): boolean {
  if (entry.kind === "condition") {
    return (
      matchesReviewFilter(pr, entry.subject, entry.values, ctx) !==
      entry.negated
    );
  }
  return matchesGroup(pr, entry, ctx);
}

function matchesGroup(
  pr: ReviewItem,
  group: ReviewsAdvancedFilter,
  ctx: FilterContext,
): boolean {
  const active = group.conditions.filter(isActiveEntry);
  if (active.length === 0) return true;
  return group.operator === "or"
    ? active.some((entry) => matchesEntry(pr, entry, ctx))
    : active.every((entry) => matchesEntry(pr, entry, ctx));
}

export function filterByAdvancedFilter(
  items: ReviewItem[],
  filter: ReviewsAdvancedFilter | null | undefined,
  ctx: FilterContext,
): ReviewItem[] {
  if (!filter || !filter.conditions.some(isActiveEntry)) return items;
  return items.filter((pr) => matchesGroup(pr, filter, ctx));
}

function sanitizeEntries(
  raw: unknown[],
  depth: number,
): ReviewsAdvancedEntry[] {
  const kept: ReviewsAdvancedEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const id =
      typeof entry.id === "string" && entry.id.length > 0
        ? entry.id
        : createAdvancedId();

    if (entry.kind === "condition") {
      if (
        typeof entry.subject === "string" &&
        (REVIEW_FILTER_IDS as readonly string[]).includes(entry.subject) &&
        Array.isArray(entry.values) &&
        entry.values.every((value) => typeof value === "string")
      ) {
        kept.push({
          kind: "condition",
          id,
          subject: entry.subject as ReviewFilterId,
          values: entry.values,
          negated: entry.negated === true,
        });
      }
      continue;
    }

    if (
      entry.kind === "group" &&
      depth < MAX_DEPTH &&
      Array.isArray(entry.conditions)
    ) {
      kept.push({
        kind: "group",
        id,
        operator: entry.operator === "and" ? "and" : "or",
        conditions: sanitizeEntries(entry.conditions, depth + 1),
      });
    }
  }
  return kept;
}

/** A saved advanced filter keeps its operator, nested groups, and migrates legacy flat filters. */
export function sanitizeReviewsAdvanced(
  saved: unknown,
): ReviewsAdvancedFilter | null {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return null;
  const { operator, conditions, filters } = saved as Record<string, unknown>;
  const op: AdvancedOperator = operator === "and" ? "and" : "or";

  if (Array.isArray(conditions)) {
    return { operator: op, conditions: sanitizeEntries(conditions, 0) };
  }

  // Migrate pre-nested `{ operator, filters }` saved views.
  if (filters && typeof filters === "object" && !Array.isArray(filters)) {
    const clean = sanitizeReviewsFilters(filters);
    const migrated: ReviewsAdvancedCondition[] = [];
    for (const id of REVIEW_FILTER_IDS) {
      const entry = clean[id];
      if (entry && entry.values.length > 0) {
        migrated.push({
          kind: "condition",
          id,
          subject: id,
          values: entry.values,
          negated: entry.negated,
        });
      }
    }
    return { operator: op, conditions: migrated };
  }

  return null;
}
