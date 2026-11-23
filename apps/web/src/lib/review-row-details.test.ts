import { describe, expect, it } from "vite-plus/test";
import {
  hasSecondLine,
  repoRef,
  statusDetailsKey,
} from "@/lib/review-row-details";
import type { ReviewItem } from "@/lib/reviews-view";

const pr = (over: Partial<ReviewItem> = {}) =>
  ({
    repo: "sigmma",
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

describe("repoRef", () => {
  it("joins Repository and ID as the properties allow", () => {
    expect(repoRef(pr(), ["repository", "id"])).toBe("sigmma#706");
    expect(repoRef(pr(), ["id"])).toBe("#706");
    expect(repoRef(pr(), ["repository"])).toBe("sigmma");
    expect(repoRef(pr(), ["date"])).toBe("");
  });
});

describe("hasSecondLine", () => {
  it("is on for Repository, ID or Status details only", () => {
    expect(hasSecondLine(["date", "author"])).toBe(false);
    expect(hasSecondLine(["date", "statusDetails"])).toBe(true);
    expect(hasSecondLine(["id"])).toBe(true);
  });
});
