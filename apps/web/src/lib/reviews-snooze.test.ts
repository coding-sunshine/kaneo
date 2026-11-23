import { expect, it } from "vite-plus/test";
import { entryFor, isSnoozed } from "./reviews-snooze";

const pull = { updatedAt: "2026-01-02T00:00:00Z", comments: 2 };
const now = new Date("2026-01-03T00:00:00Z");

it("has no snooze without an entry", () => {
  expect(isSnoozed(undefined, pull, now)).toBe(false);
});

it("snoozes until a time, then wakes", () => {
  const entry = entryFor(pull, { until: new Date("2026-01-04T00:00:00Z") });
  expect(isSnoozed(entry, pull, now)).toBe(true);
  expect(isSnoozed(entry, pull, new Date("2026-01-04T00:00:01Z"))).toBe(false);
});

it("wakes on a new comment", () => {
  const entry = entryFor(pull, { mode: "newComment" });
  expect(isSnoozed(entry, pull, now)).toBe(true);
  expect(isSnoozed(entry, { ...pull, comments: 3 }, now)).toBe(false);
});

it("wakes on new activity for new review", () => {
  const entry = entryFor(pull, { mode: "newReview" });
  expect(isSnoozed(entry, pull, now)).toBe(true);
  expect(
    isSnoozed(entry, { ...pull, updatedAt: "2026-01-02T00:00:01Z" }, now),
  ).toBe(false);
});
