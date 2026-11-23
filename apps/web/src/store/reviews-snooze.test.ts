import { beforeEach, expect, it } from "vite-plus/test";
import { entryFor } from "@/lib/reviews-snooze";
import { useReviewsSnoozeStore } from "./reviews-snooze";

beforeEach(() => useReviewsSnoozeStore.setState({ entries: {} }));

it("snoozes and unsnoozes by key", () => {
  const entry = entryFor(
    { updatedAt: "2026-01-01T00:00:00Z", comments: 0 },
    { mode: "newComment" },
  );
  useReviewsSnoozeStore.getState().snooze("a/b#1", entry);
  expect(useReviewsSnoozeStore.getState().entries["a/b#1"]).toEqual(entry);
  useReviewsSnoozeStore.getState().unsnooze("a/b#1");
  expect(useReviewsSnoozeStore.getState().entries).toEqual({});
});
