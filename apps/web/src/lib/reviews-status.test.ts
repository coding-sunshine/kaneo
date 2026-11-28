import { describe, expect, it } from "vite-plus/test";
import { reviewStatus } from "@/lib/reviews-status";

const pr = (over: Partial<Parameters<typeof reviewStatus>[0]> = {}) => ({
  status: "open" as const,
  reviewDecision: null,
  approvedBy: [],
  changesRequestedBy: [],
  ...over,
});

describe("reviewStatus", () => {
  it("keeps draft, merged and closed", () => {
    expect(reviewStatus(pr({ status: "draft" }))).toBe("draft");
    expect(reviewStatus(pr({ status: "merged", approvedBy: ["a"] }))).toBe(
      "merged",
    );
    expect(reviewStatus(pr({ status: "closed" }))).toBe("closed");
  });

  it("calls a pull request with only a requested review Open", () => {
    expect(reviewStatus(pr({ reviewDecision: "review_required" }))).toBe(
      "open",
    );
    expect(reviewStatus(pr())).toBe("open");
  });

  it("calls an approved open pull request Approved", () => {
    expect(reviewStatus(pr({ reviewDecision: "approved" }))).toBe("approved");
  });

  it("calls a pull request with a submitted review In review", () => {
    expect(reviewStatus(pr({ approvedBy: ["synthetic-author"] }))).toBe(
      "inReview",
    );
    expect(
      reviewStatus(pr({ changesRequestedBy: ["synthetic-reviewer"] })),
    ).toBe("inReview");
    expect(reviewStatus(pr({ reviewDecision: "changes_requested" }))).toBe(
      "inReview",
    );
  });
});
