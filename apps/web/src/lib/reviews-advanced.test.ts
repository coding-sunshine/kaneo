import { describe, expect, it } from "vite-plus/test";
import {
  countAdvancedConditions,
  filterByAdvancedFilter,
  type ReviewsAdvancedFilter,
  sanitizeReviewsAdvanced,
} from "./reviews-advanced";

const ctx = { me: "me", now: new Date("2026-03-10T12:00:00Z") };

const pr = (number: number, over: object = {}) =>
  ({
    number,
    owner: "acme",
    repo: "web",
    title: `PR ${number}`,
    status: "open",
    reviewDecision: null,
    checks: "none",
    additions: 0,
    deletions: 0,
    hasConflicts: false,
    mergeState: "unknown",
    author: { login: "ada", avatarUrl: "" },
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

const numbers = (list: unknown[]) =>
  list.map((item) => (item as { number: number }).number);

describe("reviews advanced filter", () => {
  it("evaluates two conditions on the same subject independently", () => {
    const items = [
      pr(1, {
        title: "Auth login",
        labels: [{ name: "bug", color: "f00" }],
        approvedBy: ["ada"],
      }),
      pr(2, {
        title: "Auth refactor",
        labels: [
          { name: "bug", color: "f00" },
          { name: "urgent", color: "0f0" },
        ],
        approvedBy: ["ada", "bo"],
      }),
      pr(3, {
        title: "Auth wip",
        labels: [{ name: "urgent", color: "0f0" }],
        approvedBy: ["bo"],
      }),
    ];

    const twoLabels: ReviewsAdvancedFilter = {
      operator: "and",
      conditions: [
        {
          kind: "condition",
          id: "c1",
          subject: "labels",
          values: ["bug"],
          negated: false,
        },
        {
          kind: "condition",
          id: "c2",
          subject: "labels",
          values: ["urgent"],
          negated: false,
        },
      ],
    };
    expect(numbers(filterByAdvancedFilter(items, twoLabels, ctx))).toEqual([2]);

    const twoContents: ReviewsAdvancedFilter = {
      operator: "and",
      conditions: [
        {
          kind: "condition",
          id: "c1",
          subject: "content",
          values: ["auth"],
          negated: false,
        },
        {
          kind: "condition",
          id: "c2",
          subject: "content",
          values: ["wip"],
          negated: true,
        },
      ],
    };
    expect(numbers(filterByAdvancedFilter(items, twoContents, ctx))).toEqual([
      1, 2,
    ]);
  });

  it("evaluates a nested group with its own and/or differently from flat conditions", () => {
    const items = [
      pr(1, { status: "open", mergeState: "blocked", hasConflicts: false }),
      pr(2, { status: "open", mergeState: "ready", hasConflicts: true }),
      pr(3, { status: "draft", mergeState: "blocked", hasConflicts: false }),
      pr(4, { status: "draft", mergeState: "ready", hasConflicts: true }),
    ];

    const flatAnd: ReviewsAdvancedFilter = {
      operator: "and",
      conditions: [
        {
          kind: "condition",
          id: "c1",
          subject: "status",
          values: ["open"],
          negated: false,
        },
        {
          kind: "condition",
          id: "c2",
          subject: "mergeStatus",
          values: ["blocked"],
          negated: false,
        },
        {
          kind: "condition",
          id: "c3",
          subject: "hasConflicts",
          values: ["true"],
          negated: false,
        },
      ],
    };
    const flatOr: ReviewsAdvancedFilter = { ...flatAnd, operator: "or" };

    // status is open AND (mergeStatus is blocked OR hasConflicts is true)
    const nestedOrInAnd: ReviewsAdvancedFilter = {
      operator: "and",
      conditions: [
        {
          kind: "condition",
          id: "c1",
          subject: "status",
          values: ["open"],
          negated: false,
        },
        {
          kind: "group",
          id: "g1",
          operator: "or",
          conditions: [
            {
              kind: "condition",
              id: "c2",
              subject: "mergeStatus",
              values: ["blocked"],
              negated: false,
            },
            {
              kind: "condition",
              id: "c3",
              subject: "hasConflicts",
              values: ["true"],
              negated: false,
            },
          ],
        },
      ],
    };

    expect(numbers(filterByAdvancedFilter(items, flatAnd, ctx))).toEqual([]);
    expect(numbers(filterByAdvancedFilter(items, flatOr, ctx))).toEqual([
      1, 2, 3, 4,
    ]);
    expect(numbers(filterByAdvancedFilter(items, nestedOrInAnd, ctx))).toEqual([
      1, 2,
    ]);
    expect(countAdvancedConditions(nestedOrInAnd)).toBe(3);

    // status is draft OR (mergeStatus is ready AND hasConflicts is true)
    const nestedAndInOr: ReviewsAdvancedFilter = {
      operator: "or",
      conditions: [
        {
          kind: "condition",
          id: "c1",
          subject: "status",
          values: ["draft"],
          negated: false,
        },
        {
          kind: "group",
          id: "g1",
          operator: "and",
          conditions: [
            {
              kind: "condition",
              id: "c2",
              subject: "mergeStatus",
              values: ["ready"],
              negated: false,
            },
            {
              kind: "condition",
              id: "c3",
              subject: "hasConflicts",
              values: ["true"],
              negated: false,
            },
          ],
        },
      ],
    };
    expect(numbers(filterByAdvancedFilter(items, nestedAndInOr, ctx))).toEqual([
      2, 3, 4,
    ]);
  });

  it("ignores empty nested groups when filtering and counting", () => {
    const items = [pr(1, { hasConflicts: true }), pr(2, {})];
    const emptyOnly: ReviewsAdvancedFilter = {
      operator: "and",
      conditions: [{ kind: "group", id: "g1", operator: "or", conditions: [] }],
    };
    expect(filterByAdvancedFilter(items, emptyOnly, ctx)).toBe(items);
    expect(countAdvancedConditions(emptyOnly)).toBe(0);

    const withEmptyGroup: ReviewsAdvancedFilter = {
      operator: "and",
      conditions: [
        {
          kind: "condition",
          id: "c1",
          subject: "hasConflicts",
          values: ["true"],
          negated: false,
        },
        { kind: "group", id: "g1", operator: "or", conditions: [] },
      ],
    };
    expect(numbers(filterByAdvancedFilter(items, withEmptyGroup, ctx))).toEqual(
      [1],
    );
    expect(countAdvancedConditions(withEmptyGroup)).toBe(1);
  });

  it("sanitizes nested groups, preserves repeated subjects, and migrates legacy flat filters", () => {
    expect(sanitizeReviewsAdvanced(null)).toBeNull();
    expect(sanitizeReviewsAdvanced("or")).toBeNull();
    expect(sanitizeReviewsAdvanced([])).toBeNull();
    expect(sanitizeReviewsAdvanced({ operator: "and" })).toBeNull();

    const nested = sanitizeReviewsAdvanced({
      operator: "and",
      conditions: [
        {
          kind: "condition",
          id: "c1",
          subject: "labels",
          values: ["bug"],
          negated: false,
        },
        {
          kind: "condition",
          id: "c2",
          subject: "labels",
          values: ["urgent"],
          negated: true,
        },
        {
          kind: "condition",
          id: "bad",
          subject: "unknown",
          values: ["x"],
          negated: false,
        },
        {
          kind: "group",
          id: "g1",
          operator: "or",
          conditions: [
            {
              kind: "condition",
              id: "c3",
              subject: "mergeStatus",
              values: ["blocked"],
              negated: false,
            },
          ],
        },
      ],
    });
    expect(nested).toEqual({
      operator: "and",
      conditions: [
        {
          kind: "condition",
          id: "c1",
          subject: "labels",
          values: ["bug"],
          negated: false,
        },
        {
          kind: "condition",
          id: "c2",
          subject: "labels",
          values: ["urgent"],
          negated: true,
        },
        {
          kind: "group",
          id: "g1",
          operator: "or",
          conditions: [
            {
              kind: "condition",
              id: "c3",
              subject: "mergeStatus",
              values: ["blocked"],
              negated: false,
            },
          ],
        },
      ],
    });

    // Legacy saved shape `{ operator, filters }` migrates cleanly.
    expect(
      sanitizeReviewsAdvanced({
        operator: "and",
        filters: {
          hasConflicts: { values: ["true"], negated: false },
          mergeStatus: { values: ["ready"], negated: true },
        },
      }),
    ).toEqual({
      operator: "and",
      conditions: [
        {
          kind: "condition",
          id: "mergeStatus",
          subject: "mergeStatus",
          values: ["ready"],
          negated: true,
        },
        {
          kind: "condition",
          id: "hasConflicts",
          subject: "hasConflicts",
          values: ["true"],
          negated: false,
        },
      ],
    });
  });
});
