import { expect, it } from "vite-plus/test";
import { isQuickToReview } from "./reviews-quick";

const pr = (over: object = {}) => ({
  status: "open" as "open" | "draft" | "merged" | "closed",
  additions: 4,
  deletions: 3,
  approvedBy: [] as string[],
  changesRequestedBy: [] as string[],
  ...over,
});

it("is quick up to 30 lines added and 100 removed", () => {
  expect(isQuickToReview(pr({ additions: 6, deletions: 4 }), "me")).toBe(true);
  expect(isQuickToReview(pr({ additions: 30, deletions: 100 }), "me")).toBe(
    true,
  );
  expect(isQuickToReview(pr({ additions: 31, deletions: 0 }), "me")).toBe(
    false,
  );
  expect(isQuickToReview(pr({ additions: 0, deletions: 101 }), "me")).toBe(
    false,
  );
});

it("is never quick for a draft, a closed pull request or one the viewer reviewed", () => {
  expect(isQuickToReview(pr({ status: "draft" }), "me")).toBe(false);
  expect(isQuickToReview(pr({ status: "merged" }), "me")).toBe(false);
  expect(isQuickToReview(pr({ approvedBy: ["me"] }), "me")).toBe(false);
  expect(isQuickToReview(pr({ changesRequestedBy: ["me"] }), "me")).toBe(false);
  expect(
    isQuickToReview(pr({ approvedBy: ["synthetic-reviewer"] }), "me"),
  ).toBe(true);
  expect(
    isQuickToReview(pr({ approvedBy: ["synthetic-reviewer"] }), null),
  ).toBe(true);
});

it("counts a comment-only review as reviewed", () => {
  expect(isQuickToReview(pr({ reviewedBy: ["me"] }), "me")).toBe(false);
  expect(
    isQuickToReview(pr({ reviewedBy: ["synthetic-reviewer"] }), "me"),
  ).toBe(true);
});

it("leaves generated lines out of the size", () => {
  const big = { additions: 500, deletions: 120 };
  expect(isQuickToReview(pr(big), "me")).toBe(false);
  expect(
    isQuickToReview(
      pr({ ...big, generatedAdditions: 480, generatedDeletions: 100 }),
      "me",
    ),
  ).toBe(true);
});
