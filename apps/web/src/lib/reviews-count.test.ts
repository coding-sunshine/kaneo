import { describe, expect, it } from "vite-plus/test";
import { reviewsCount, toggleCountOption } from "./reviews-count";

const pr = (over: object) => over as never;
const data = {
  toReview: [pr({ teamRequested: false }), pr({ teamRequested: true })],
  created: [
    pr({ status: "open", mergeState: "ready" }),
    pr({ status: "draft", mergeState: "ready" }),
    pr({ status: "open", mergeState: "blocked" }),
  ],
};

describe("reviewsCount", () => {
  it("counts requested, team and ready to merge by default", () => {
    expect(reviewsCount(data, ["requested", "team", "readyToMerge"])).toBe(3);
  });
  it("counts each option on its own", () => {
    expect(reviewsCount(data, ["requested"])).toBe(1);
    expect(reviewsCount(data, ["team"])).toBe(1);
    expect(reviewsCount(data, ["readyToMerge"])).toBe(1);
    expect(reviewsCount(data, [])).toBe(0);
  });
});

describe("toggleCountOption", () => {
  it("adds and removes, keeping the canonical order", () => {
    expect(toggleCountOption(["team"], "requested")).toEqual([
      "requested",
      "team",
    ]);
    expect(toggleCountOption(["requested", "team"], "team")).toEqual([
      "requested",
    ]);
  });
});
