import { beforeEach, describe, expect, it } from "vite-plus/test";
import { DEFAULT_DIFF_OPTIONS } from "@/components/reviews/diff-options-menu";
import { useReviewsDiffOptionsStore } from "./reviews-diff-options";

beforeEach(() => {
  localStorage.clear();
  useReviewsDiffOptionsStore.setState({ options: DEFAULT_DIFF_OPTIONS });
});

describe("reviews diff options store", () => {
  it("merges a patch and saves it", () => {
    useReviewsDiffOptionsStore.getState().set({ order: "changes", desc: true });
    expect(useReviewsDiffOptionsStore.getState().options).toEqual({
      ...DEFAULT_DIFF_OPTIONS,
      order: "changes",
      desc: true,
    });
    expect(localStorage.getItem("reviews-diff-options")).toContain("changes");
  });

  it("gives an option missing from an older save its default", async () => {
    localStorage.setItem(
      "reviews-diff-options",
      JSON.stringify({ state: { options: { wrap: true } }, version: 0 }),
    );
    await useReviewsDiffOptionsStore.persist.rehydrate();
    expect(useReviewsDiffOptionsStore.getState().options).toEqual({
      ...DEFAULT_DIFF_OPTIONS,
      wrap: true,
    });
  });
});
