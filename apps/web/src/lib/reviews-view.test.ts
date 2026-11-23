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
  moveTab,
  sanitizeTabOrder,
  type ReviewsTab,
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
    approvedBy: [],
    changesRequestedBy: [],
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
    const bucket = (lines: number) =>
      sizeBucket(pr({ additions: lines, deletions: 0 }));
    expect([0, 10, 11, 50, 250, 1000, 5000, 5001].map(bucket)).toEqual([
      "u10",
      "u10",
      "u50",
      "u50",
      "u250",
      "u1000",
      "u5000",
      "over",
    ]);
  });

  it("moves tabs one step and keeps a valid saved order", () => {
    expect(moveTab(["created", "toReview"], "created", 1)).toEqual([
      "toReview",
      "created",
    ]);
    const order: ReviewsTab[] = ["created", "toReview"];
    expect(moveTab(order, "created", -1)).toBe(order);
    expect(moveTab(order, "toReview", 1)).toBe(order);
    expect(sanitizeTabOrder(["toReview", "created"])).toEqual([
      "toReview",
      "created",
    ]);
    expect(sanitizeTabOrder(["toReview", "toReview"])).toEqual(order);
    expect(sanitizeTabOrder(undefined)).toEqual(order);
  });

  it("groups by the six Status values in Linear's order", () => {
    const items = [
      pr({ number: 1, status: "closed" }),
      pr({ number: 2, status: "open", reviewDecision: "approved" }),
      pr({ number: 3, status: "open", approvedBy: ["ada"] }),
      pr({ number: 4, status: "open" }),
      pr({ number: 5, status: "merged" }),
      pr({ number: 6, status: "draft" }),
    ];
    const groups = buildGroups(items, {
      groupBy: "status",
      subGroupBy: "none",
      pinned: [],
    });
    expect(groups.map((g) => g.key)).toEqual([
      "draft",
      "open",
      "inReview",
      "approved",
      "merged",
      "closed",
    ]);
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

  describe("linked task", () => {
    const issue = (
      priority: string,
      team = "Platform",
      project: string | null = null,
    ) => ({
      taskId: "t",
      workspaceId: "w",
      linkId: "l",
      manual: false,
      title: "",
      priority,
      team: { id: team, name: team },
      project: project ? { id: project, name: project } : null,
    });
    const items = [
      pr({ number: 1 }),
      pr({ number: 2, issue: issue("low", "Web", "Launch") }),
      pr({ number: 3, issue: issue("urgent") }),
      pr({ number: 4, issue: issue("urgent", "Web") }),
    ];
    const none = { subGroupBy: "none" as const, pinned: [] };

    it("groups by the linked task's priority, unlinked last", () => {
      const groups = buildGroups(items, { ...none, groupBy: "priority" });
      expect(groups.map((g) => g.key)).toEqual([
        "urgent",
        "low",
        "no-priority",
      ]);
      expect(groups[0]?.items.map((p) => p.number)).toEqual([3, 4]);
    });

    it("groups by team (Kaneo project) and project (work project)", () => {
      const teams = buildGroups(items, { ...none, groupBy: "team" });
      expect(teams.map((g) => g.key)).toEqual(["", "Platform", "Web"]);
      const projects = buildGroups(items, { ...none, groupBy: "project" });
      expect(projects.map((g) => g.key)).toEqual(["", "Launch"]);
      expect(projects[0]?.items.map((p) => p.number)).toEqual([1, 3, 4]);
    });

    it("orders by issue priority in either direction, unlinked last", () => {
      const asc = sortPullRequests(items, {
        sortBy: "issuePriority",
        sortDirection: "asc",
      });
      expect(asc.map((p) => p.number)).toEqual([3, 4, 2, 1]);
      const desc = sortPullRequests(items, {
        sortBy: "issuePriority",
        sortDirection: "desc",
      });
      expect(desc.map((p) => p.number)).toEqual([1, 2, 3, 4]);
    });
  });
});
