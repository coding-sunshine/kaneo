import { describe, expect, it } from "vite-plus/test";
import {
  activeFilterCount,
  approverLogins,
  clearFilter,
  filterByReviewFilters,
  setFilterNegated,
  toggleFilterValue,
} from "./reviews-filters";

const pr = (number: number, over: object) =>
  ({
    number,
    hasConflicts: false,
    mergeState: "unknown",
    approvedBy: [],
    ...over,
  }) as never;
const items = [
  pr(1, { hasConflicts: true, mergeState: "blocked" }),
  pr(2, { mergeState: "ready", approvedBy: ["ada"] }),
  pr(3, { mergeState: "behind", approvedBy: ["bo", "ada"] }),
  pr(4, {}),
];
const numbers = (list: unknown[]) =>
  list.map((p) => (p as { number: number }).number);

describe("filterByReviewFilters", () => {
  it("returns everything with no active filter", () => {
    expect(filterByReviewFilters(items, {})).toBe(items);
    expect(
      filterByReviewFilters(items, {
        mergeStatus: { values: [], negated: false },
      }),
    ).toBe(items);
  });

  it("narrows by conflicts, merge status and approver, all together", () => {
    const only = (filters: Parameters<typeof filterByReviewFilters>[1]) =>
      numbers(filterByReviewFilters(items, filters));
    expect(
      only({ hasConflicts: { values: ["true"], negated: false } }),
    ).toEqual([1]);
    expect(only({ hasConflicts: { values: ["true"], negated: true } })).toEqual(
      [2, 3, 4],
    );
    expect(
      only({ mergeStatus: { values: ["ready", "behind"], negated: false } }),
    ).toEqual([2, 3]);
    expect(only({ approvedBy: { values: ["bo"], negated: false } })).toEqual([
      3,
    ]);
    expect(
      only({
        approvedBy: { values: ["ada"], negated: false },
        mergeStatus: { values: ["ready"], negated: false },
      }),
    ).toEqual([2]);
  });
});

describe("filter state", () => {
  it("toggles values, negates, clears and counts", () => {
    let filters = toggleFilterValue({}, "approvedBy", "ada");
    filters = toggleFilterValue(filters, "approvedBy", "bo");
    expect(filters.approvedBy?.values).toEqual(["ada", "bo"]);
    filters = toggleFilterValue(filters, "approvedBy", "ada");
    expect(filters.approvedBy?.values).toEqual(["bo"]);
    filters = setFilterNegated(filters, "approvedBy", true);
    expect(filters.approvedBy).toEqual({ values: ["bo"], negated: true });
    expect(activeFilterCount(filters)).toBe(1);
    expect(clearFilter(filters, "approvedBy")).toEqual({});
  });

  it("lists approvers once, sorted", () => {
    expect(approverLogins(items)).toEqual(["ada", "bo"]);
  });
});
