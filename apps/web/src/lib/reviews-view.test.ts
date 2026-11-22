import { describe, expect, it } from "vite-plus/test";
import type { ReviewPullRequest } from "@/fetchers/github-reviews/github-reviews";
import { buildGroups, flattenGroups, sizeBucket } from "./reviews-view";

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
    ...over,
  }) as ReviewPullRequest;

describe("reviews view", () => {
  it("buckets size by changed lines", () => {
    expect(sizeBucket(pr({ additions: 5, deletions: 4 }))).toBe("xs");
    expect(sizeBucket(pr({ additions: 600, deletions: 500 }))).toBe("xl");
  });

  it("nests a subgroup and keeps rows in screen order", () => {
    const items = [
      pr({ number: 1, repo: "web", checks: "success" }),
      pr({ number: 2, repo: "api", checks: "failure" }),
      pr({ number: 3, repo: "web", checks: "failure" }),
    ];
    const groups = buildGroups(items, {
      groupBy: "repository",
      subGroupBy: "checks",
      pinned: [],
    });
    expect(groups.map((g) => g.key)).toEqual(["acme/api", "acme/web"]);
    expect(groups[1]?.children.map((g) => g.key)).toEqual([
      "failure",
      "success",
    ]);
    expect(flattenGroups(groups).map((p) => p.number)).toEqual([2, 3, 1]);
  });
});
