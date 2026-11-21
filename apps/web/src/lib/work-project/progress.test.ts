import { describe, expect, it } from "vite-plus/test";
import { workProjectPriorityFromKey, workProjectPriorityKey } from "./priority";
import { progressPercent } from "./progress";

describe("progressPercent", () => {
  it("rounds done over total", () => {
    expect(progressPercent({ total: 3, done: 1 })).toBe(33);
    expect(progressPercent({ total: 8, done: 7 })).toBe(88);
    expect(progressPercent({ total: 1, done: 1 })).toBe(100);
  });

  it("is 0 with no issues", () => {
    expect(progressPercent({ total: 0, done: 0 })).toBe(0);
  });
});

describe("work project priority", () => {
  it("maps Linear's numeric priority both ways", () => {
    expect(workProjectPriorityKey(1)).toBe("urgent");
    expect(workProjectPriorityKey(0)).toBe("no-priority");
    expect(workProjectPriorityKey(9)).toBe("no-priority");
    expect(workProjectPriorityFromKey("low")).toBe(4);
    expect(workProjectPriorityFromKey("bogus")).toBe(0);
  });
});
