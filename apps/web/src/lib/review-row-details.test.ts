import { describe, expect, it } from "vite-plus/test";
import { rowContext, statusDetailsKey } from "@/lib/review-row-details";
import type { ReviewItem } from "@/lib/reviews-view";

const pr = (over: Partial<ReviewItem> = {}) =>
  ({
    owner: "acme",
    repo: "sigmma",
    author: { login: "octo", avatarUrl: "" },
    headRef: "release-please--main",
    baseRef: "main",
    number: 706,
    status: "open",
    reviewers: [],
    teamReviewers: [],
    ...over,
  }) as ReviewItem;

describe("statusDetailsKey", () => {
  it("says Draft for drafts, even in To review", () => {
    expect(statusDetailsKey(pr({ status: "draft" }))).toBe("draft");
    expect(
      statusDetailsKey(pr({ status: "draft", focus: "needsReview" })),
    ).toBe("draft");
  });
  it("says waiting for your review on To review rows that need it", () => {
    expect(statusDetailsKey(pr({ focus: "needsReview" }))).toBe(
      "waitingForYou",
    );
    expect(
      statusDetailsKey(
        pr({ focus: "done", reviewers: [{ login: "a", avatarUrl: "" }] }),
      ),
    ).toBeNull();
  });
  it("says no reviewers for an open pull request nobody was asked to review", () => {
    expect(statusDetailsKey(pr())).toBe("noReviewers");
    expect(statusDetailsKey(pr({ teamReviewers: ["core"] }))).toBeNull();
    expect(statusDetailsKey(pr({ status: "merged" }))).toBeNull();
  });
});

describe("rowContext", () => {
  it("names owner/repo, the author and head → base, with #number when ID is on", () => {
    expect(rowContext(pr(), ["date"])).toBe(
      "acme/sigmma · octo · release-please--main → main",
    );
    expect(rowContext(pr(), ["id"])).toBe(
      "acme/sigmma#706 · octo · release-please--main → main",
    );
  });
  it("leaves out an author GitHub no longer has", () => {
    expect(rowContext(pr({ author: null }), [])).toBe(
      "acme/sigmma · release-please--main → main",
    );
  });
});
