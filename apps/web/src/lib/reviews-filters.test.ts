import { describe, expect, it } from "vite-plus/test";
import {
  activeFilterCount,
  clearFilter,
  countMatches,
  filterByReviewFilters,
  parseCustomDate,
  type ReviewsFilters,
  sanitizeReviewsAdvanced,
  sanitizeReviewsFilters,
  setFilterNegated,
  toggleFilterValue,
} from "./reviews-filters";

const ctx = { me: "me", now: new Date("2026-03-10T12:00:00Z") };

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
    expect(filterByReviewFilters(items, {}, ctx)).toBe(items);
    expect(
      filterByReviewFilters(
        items,
        {
          mergeStatus: { values: [], negated: false },
        },
        ctx,
      ),
    ).toBe(items);
  });

  it("narrows by conflicts, merge status and approver, all together", () => {
    const only = (filters: Parameters<typeof filterByReviewFilters>[1]) =>
      numbers(filterByReviewFilters(items, filters, ctx));
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

  it("keeps one value for date and Content filters", () => {
    let filters = toggleFilterValue({}, "opened", "1d");
    filters = toggleFilterValue(filters, "opened", "1w");
    expect(filters.opened?.values).toEqual(["1w"]);
  });

  it("drops unknown ids and malformed entries from saved filters", () => {
    expect(
      sanitizeReviewsFilters({
        status: { values: ["open"], negated: true },
        gone: { values: ["x"], negated: false },
        size: { values: [1], negated: false },
      }),
    ).toEqual({ status: { values: ["open"], negated: true } });
    expect(sanitizeReviewsFilters(null)).toEqual({});
  });
});

const person = (login: string) => ({ login, avatarUrl: "" });
const full = (number: number, over: object) =>
  ({
    number,
    owner: "acme",
    repo: "web",
    title: `Fix ${number}`,
    status: "open",
    reviewDecision: null,
    checks: "none",
    additions: 0,
    deletions: 0,
    hasConflicts: false,
    mergeState: "unknown",
    author: person("zed"),
    reviewers: [],
    teamReviewers: [],
    approvedBy: [],
    changesRequestedBy: [],
    labels: [],
    issue: null,
    createdAt: "2026-03-10T00:00:00Z",
    updatedAt: "2026-03-10T00:00:00Z",
    closedAt: null,
    ...over,
  }) as never;
const issue = (priority: string, team: string, project: string | null) => ({
  priority,
  team: { id: team, name: team },
  project: project ? { id: project, name: project } : null,
});

describe("every subject", () => {
  const list = [
    full(1, { status: "draft", checks: "failure", additions: 5 }),
    full(2, {
      reviewDecision: "approved",
      approvedBy: ["ada"],
      checks: "success",
      mergeState: "ready",
      additions: 30,
      author: person("me"),
      reviewers: [person("ada")],
      issue: issue("urgent", "Core", "Q1"),
    }),
    full(3, {
      approvedBy: ["ada", "bo"],
      changesRequestedBy: ["cy"],
      checks: "pending",
      mergeState: "queued",
      additions: 400,
      owner: "globex",
      repo: "api",
      teamReviewers: ["platform"],
      labels: [{ name: "bug", color: "f00" }],
      issue: issue("no-priority", "Core", null),
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-03-09T00:00:00Z",
    }),
    full(4, {
      status: "merged",
      additions: 6000,
      closedAt: "2026-03-09T00:00:00Z",
      createdAt: "2025-01-01T00:00:00Z",
      title: "Release notes",
    }),
    full(5, { status: "closed", closedAt: "2026-02-01T00:00:00Z" }),
  ];
  const only = (id: keyof ReviewsFilters, ...values: string[]) =>
    numbers(
      filterByReviewFilters(list, { [id]: { values, negated: false } }, ctx),
    );

  it("status", () => {
    expect(only("status", "draft")).toEqual([1]);
    expect(only("status", "approved")).toEqual([2]);
    expect(only("status", "inReview")).toEqual([3]);
    expect(only("status", "open")).toEqual([]);
    expect(only("status", "merged", "closed")).toEqual([4, 5]);
  });
  it("merge status, checks, conflicts, size", () => {
    expect(only("mergeStatus", "ready")).toEqual([2]);
    expect(only("mergeStatus", "queued")).toEqual([3]);
    expect(only("checks", "failure")).toEqual([1]);
    expect(only("checks", "success", "pending")).toEqual([2, 3]);
    expect(only("checks", "canceled")).toEqual([]);
    expect(only("size", "u10")).toEqual([1, 5]);
    expect(only("size", "u50")).toEqual([2]);
    expect(only("size", "over")).toEqual([4]);
  });
  it("people, with Current user", () => {
    expect(only("author", "@me")).toEqual([2]);
    expect(only("author", "zed")).toEqual([1, 3, 4, 5]);
    expect(only("reviewers", "ada")).toEqual([2]);
    expect(only("reviewers", "@me")).toEqual([]);
    expect(only("teamReviewers", "platform")).toEqual([3]);
    expect(only("approvedBy", "bo")).toEqual([3]);
    expect(only("changesRequestedBy", "cy")).toEqual([3]);
  });
  it("approvals", () => {
    expect(only("approvals", "none")).toEqual([1, 4, 5]);
    expect(only("approvals", "exactly1")).toEqual([2]);
    expect(only("approvals", "min2")).toEqual([3]);
    expect(only("approvals", "min1")).toEqual([2, 3]);
  });
  it("linked issue: project, team, priority, missing", () => {
    expect(only("project", "Q1")).toEqual([2]);
    expect(only("team", "Core")).toEqual([2, 3]);
    expect(only("priority", "urgent")).toEqual([2]);
    expect(only("priority", "no-priority")).toEqual([1, 3, 4, 5]);
    expect(only("missingIssue", "true")).toEqual([1, 4, 5]);
  });
  it("repository, labels, content", () => {
    expect(only("repoOwner", "globex")).toEqual([3]);
    expect(only("repoName", "api")).toEqual([3]);
    expect(only("labels", "bug")).toEqual([3]);
    expect(only("content", "release")).toEqual([4]);
  });
  it("dates: within the last N, merged and closed by status", () => {
    expect(only("opened", "1d")).toEqual([1, 2, 5]);
    expect(only("opened", "1y")).toEqual([1, 2, 3, 5]);
    expect(only("updated", "3d")).toEqual([1, 2, 3, 4, 5]);
    expect(only("merged", "1w")).toEqual([4]);
    expect(only("closed", "1w")).toEqual([]);
    expect(only("closed", "3m")).toEqual([5]);
  });
  it("counts one value alone", () => {
    expect(countMatches(list, "approvedBy", "ada", ctx)).toBe(2);
  });
});

describe("advanced filter", () => {
  const filters: ReviewsFilters = {
    hasConflicts: { values: ["true"], negated: false },
    mergeStatus: { values: ["ready"], negated: false },
  };

  it("joins its conditions with or, or with and", () => {
    expect(numbers(filterByReviewFilters(items, filters, ctx, "or"))).toEqual([
      1, 2,
    ]);
    expect(numbers(filterByReviewFilters(items, filters, ctx, "and"))).toEqual(
      [],
    );
  });

  it("matches quick pull requests, and the rest when negated", () => {
    const sized = [
      pr(1, { status: "open", additions: 2, deletions: 1 }),
      pr(2, { status: "open", additions: 400, deletions: 0 }),
    ].map((item) => ({ ...(item as object), changesRequestedBy: [] }) as never);
    const quick = (negated: boolean) =>
      numbers(
        filterByReviewFilters(
          sized,
          { quickToReview: { values: ["true"], negated } },
          ctx,
        ),
      );
    expect(quick(false)).toEqual([1]);
    expect(quick(true)).toEqual([2]);
  });

  it("keeps a saved advanced filter and repairs a broken one", () => {
    expect(sanitizeReviewsAdvanced(null)).toBeNull();
    expect(sanitizeReviewsAdvanced("or")).toBeNull();
    expect(sanitizeReviewsAdvanced([])).toBeNull();
    expect(sanitizeReviewsAdvanced({ operator: "and" })).toBeNull();
    expect(sanitizeReviewsAdvanced({ operator: "and", filters })).toEqual({
      operator: "and",
      filters,
    });
    expect(
      sanitizeReviewsAdvanced({ operator: "xor", filters: { nope: 1 } }),
    ).toEqual({ operator: "or", filters: {} });
  });
});

describe("custom dates", () => {
  const now = new Date("2026-03-10T12:00:00Z");
  it("parses past timeframes and dates, rejects the rest", () => {
    expect(parseCustomDate("10 days ago", now)).toEqual(
      new Date("2026-02-28T12:00:00Z"),
    );
    expect(parseCustomDate("2 weeks ago", now)).toEqual(
      new Date("2026-02-24T12:00:00Z"),
    );
    expect(parseCustomDate("1 year ago", now)).toEqual(
      new Date("2025-03-10T12:00:00Z"),
    );
    expect(parseCustomDate("yesterday", now)).toEqual(
      new Date("2026-03-09T12:00:00Z"),
    );
    expect(parseCustomDate("2026-03-01", now)).toEqual(new Date(2026, 2, 1));
    expect(parseCustomDate("in 3 days", now)).toBeNull();
    expect(parseCustomDate("1w", now)).toBeNull();
    expect(parseCustomDate("nonsense", now)).toBeNull();
  });

  it("filters opened by a custom value and ignores an invalid one", () => {
    const prs = [
      pr(1, { createdAt: "2026-03-09T00:00:00Z" }),
      pr(2, { createdAt: "2026-02-01T00:00:00Z" }),
    ];
    const run = (value: string) =>
      numbers(
        filterByReviewFilters(
          prs,
          { opened: { values: [value], negated: false } },
          ctx,
        ),
      );
    expect(run("10 days ago")).toEqual([1]);
    expect(run("2026-01-01")).toEqual([1, 2]);
    expect(run("garbage")).toEqual([]);
  });
});
