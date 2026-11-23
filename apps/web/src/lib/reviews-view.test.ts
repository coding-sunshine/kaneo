import { describe, expect, it } from "vite-plus/test";
import type {
  ReviewPullRequest,
  ReviewsList,
} from "@/fetchers/github-reviews/github-reviews";
import {
  buildGroups,
  DEFAULT_REVIEWS_VIEWS,
  fetchWindow,
  sanitizeReviewsViews,
  sizeBucket,
  sortPullRequests,
  tabItems,
  visibleRows,
} from "./reviews-view";

const pr = (over: Partial<ReviewPullRequest>) =>
  ({
    owner: "acme",
    repo: "web",
    number: 1,
    title: "t",
    status: "open",
    author: { login: "ada", avatarUrl: "" },
    reviewDecision: null,
    checks: "none",
    additions: 0,
    deletions: 0,
    createdAt: "2026-03-01T00:00:00Z",
    updatedAt: "2026-03-01T00:00:00Z",
    closedAt: null,
    ...over,
  }) as ReviewPullRequest;

const now = new Date("2026-03-10T12:00:00Z");

describe("reviews view", () => {
  it("buckets size by changed lines", () => {
    expect(sizeBucket(pr({ additions: 5, deletions: 4 }))).toBe("xs");
    expect(sizeBucket(pr({ additions: 600, deletions: 500 }))).toBe("xl");
  });

  it("nests a subgroup and skips rows in collapsed groups", () => {
    const items = [
      pr({ number: 1, repo: "web", status: "open" }),
      pr({ number: 2, repo: "api", status: "merged" }),
      pr({ number: 3, repo: "web", status: "draft" }),
    ];
    const groups = buildGroups(items, {
      groupBy: "repository",
      subGroupBy: "status",
      pinned: [],
    });
    expect(groups.map((g) => g.key)).toEqual(["acme/api", "acme/web"]);
    expect(groups[1]?.children.map((g) => g.key)).toEqual(["draft", "open"]);
    expect(visibleRows(groups).map((p) => p.number)).toEqual([2, 3, 1]);
    expect(
      visibleRows(groups, ["repository:acme/api"]).map((p) => p.number),
    ).toEqual([3, 1]);
  });

  it("splits To review into needs-review and done, and windows closed PRs", () => {
    const data = {
      created: [],
      toReview: [pr({ number: 1 })],
      participated: [
        pr({ number: 2, status: "merged", closedAt: "2026-03-10T00:00:00Z" }),
        pr({ number: 3, status: "merged", closedAt: "2026-03-05T00:00:00Z" }),
        pr({ number: 4, status: "draft" }),
      ],
    } as unknown as ReviewsList;
    const day = tabItems(
      data,
      "toReview",
      { closed: "day", showDrafts: true },
      now,
    );
    expect(day.map((p) => [p.number, p.focus])).toEqual([
      [1, "needsReview"],
      [2, "done"],
      [4, "done"],
    ]);
    const noDrafts = tabItems(
      data,
      "toReview",
      { closed: "week", showDrafts: false },
      now,
    );
    expect(noDrafts.map((p) => p.number)).toEqual([1, 2, 3]);
    const groups = buildGroups(day, {
      groupBy: "focus",
      subGroupBy: "none",
      pinned: [],
    });
    expect(groups.map((g) => g.key)).toEqual(["needsReview", "done"]);
  });

  it("orders closest to merge: approved and green first, finished last", () => {
    const items = [
      pr({ number: 1, status: "merged" }),
      pr({ number: 2, reviewDecision: "changes_requested", checks: "success" }),
      pr({ number: 3, reviewDecision: "approved", checks: "success" }),
      pr({ number: 4, status: "draft", reviewDecision: "approved" }),
      pr({ number: 5, checks: "failure" }),
    ];
    const sorted = sortPullRequests(items, {
      sortBy: "closestToMerge",
      sortDirection: "asc",
    });
    expect(sorted.map((p) => p.number)).toEqual([3, 5, 2, 4, 1]);
  });

  it("orders by opened, merged or closed date in either direction", () => {
    const items = [
      pr({ number: 1, createdAt: "2026-03-01T00:00:00Z" }),
      pr({
        number: 2,
        createdAt: "2026-01-01T00:00:00Z",
        closedAt: "2026-03-05T00:00:00Z",
      }),
    ];
    const desc = sortPullRequests(items, {
      sortBy: "date",
      sortDirection: "desc",
    });
    expect(desc.map((p) => p.number)).toEqual([2, 1]);
    const asc = sortPullRequests(items, {
      sortBy: "date",
      sortDirection: "asc",
    });
    expect(asc.map((p) => p.number)).toEqual([1, 2]);
  });

  it("fetches the widest closed window either tab shows", () => {
    expect(fetchWindow(DEFAULT_REVIEWS_VIEWS)).toBe("week");
    expect(
      fetchWindow({
        ...DEFAULT_REVIEWS_VIEWS,
        toReview: { ...DEFAULT_REVIEWS_VIEWS.toReview, closed: "all" },
      }),
    ).toBe("all");
  });

  it("keeps saved values that still exist and drops the rest", () => {
    expect(sanitizeReviewsViews(undefined)).toEqual(DEFAULT_REVIEWS_VIEWS);
    // The flat shape saved before views were per tab.
    expect(
      sanitizeReviewsViews({ groupBy: "reviewStatus", sortBy: "title" }),
    ).toEqual(DEFAULT_REVIEWS_VIEWS);
    const views = sanitizeReviewsViews({
      created: {
        groupBy: "focus",
        sortBy: "created",
        closed: "month",
        properties: ["id", "size"],
        pinned: "x",
      },
      toReview: { groupBy: "author", showDrafts: false },
    });
    expect(views.created).toEqual({
      ...DEFAULT_REVIEWS_VIEWS.created,
      closed: "month",
      properties: ["id"],
    });
    expect(views.toReview).toEqual({
      ...DEFAULT_REVIEWS_VIEWS.toReview,
      groupBy: "author",
      showDrafts: false,
    });
  });
});
