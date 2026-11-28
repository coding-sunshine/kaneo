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

// Linear's added and removed counts leave out changed lines; GitHub's include
// them once on each side. Cases below give GitHub's totals plus changed lines.
it("applies Linear's changed-line rule", () => {
  // Linear 5 added, 5 removed, 4 changed: over 10 lines and over 3 changed.
  expect(
    isQuickToReview(pr({ additions: 9, deletions: 9, changedLines: 4 }), "me"),
  ).toBe(false);
  // Linear 3 / 3 / 4: 10 lines in all.
  expect(
    isQuickToReview(pr({ additions: 7, deletions: 7, changedLines: 4 }), "me"),
  ).toBe(true);
  // Linear 30 / 100 / 3, though GitHub's totals are 33 and 103.
  expect(
    isQuickToReview(
      pr({ additions: 33, deletions: 103, changedLines: 3 }),
      "me",
    ),
  ).toBe(true);
  // 30 changed lines fit GitHub's 30 / 100 totals but not Linear's rule.
  expect(
    isQuickToReview(
      pr({ additions: 30, deletions: 30, changedLines: 30 }),
      "me",
    ),
  ).toBe(false);
});

it("never lets one side count below zero", () => {
  // Unclamped, added would be -5 and pull the 10-line total down to 6.
  expect(
    isQuickToReview(
      pr({
        additions: 5,
        deletions: 11,
        generatedAdditions: 5,
        changedLines: 5,
      }),
      "me",
    ),
  ).toBe(false);
});
