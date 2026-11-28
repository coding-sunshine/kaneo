import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import "@/lib/i18n";
import type { ReviewItem } from "@/lib/reviews-view";
import { ReviewRowQuick } from "./review-row-quick";

vi.mock("@/hooks/queries/github-reviews/use-github-reviews", () => ({
  useReviewsStatus: () => ({ data: { login: "hook-login" } }),
}));

const pr = {
  status: "open",
  additions: 4,
  deletions: 3,
  approvedBy: [],
  changesRequestedBy: [],
  reviewedBy: ["hook-login"],
} as unknown as ReviewItem;

describe("ReviewRowQuick", () => {
  it("uses the login it is given instead of asking for status on every row", async () => {
    const { rerender } = render(<ReviewRowQuick pr={pr} me="other-login" />);
    // Translations load async; the first render can suspend.
    expect(
      await screen.findByText("Quick", {}, { timeout: 10_000 }),
    ).toBeVisible();
    rerender(<ReviewRowQuick pr={pr} me="hook-login" />);
    expect(screen.queryByText("Quick")).toBeNull();
  });
});
