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
  expect(isQuickToReview(pr({ approvedBy: ["ada"] }), "me")).toBe(true);
  expect(isQuickToReview(pr({ approvedBy: ["ada"] }), null)).toBe(true);
});
