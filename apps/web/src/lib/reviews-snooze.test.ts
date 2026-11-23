import { expect, it } from "vite-plus/test";
import { entryFor, isSnoozed, splitSnoozed } from "./reviews-snooze";

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

it("splits snoozed rows from active ones, ignoring expired and fired snoozes", () => {
  const row = (number: number, extra = {}) => ({
    owner: "acme",
    repo: "web",
    number,
    ...pull,
    ...extra,
  });
  const entries = {
    "acme/web#1": entryFor(pull, { until: new Date("2026-01-04T00:00:00Z") }),
    "acme/web#2": entryFor(pull, { until: new Date("2026-01-02T12:00:00Z") }),
    "acme/web#3": entryFor(pull, { mode: "newComment" }),
    "acme/web#4": entryFor(pull, { mode: "newComment" }),
  };
  const { active, snoozed } = splitSnoozed(
    [row(1), row(2), row(3), row(4, { comments: 3 }), row(5)],
    entries,
    now,
  );
  expect(snoozed.map((pr) => pr.number)).toEqual([1, 3]);
  expect(active.map((pr) => pr.number)).toEqual([2, 4, 5]);
});
