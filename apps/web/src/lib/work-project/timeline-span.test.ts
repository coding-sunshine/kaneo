import { describe, expect, it } from "vite-plus/test";
import { timelineSpan } from "./timeline-span";

describe("timelineSpan", () => {
  it("places bars on the span every project shares", () => {
    const a = {
      startDate: "2027-01-01T00:00:00.000Z",
      targetDate: "2027-01-11T00:00:00.000Z",
    };
    const b = {
      startDate: "2027-01-06T00:00:00.000Z",
      targetDate: "2027-01-21T00:00:00.000Z",
    };
    const bar = timelineSpan([a, b]);
    expect(bar?.(a)).toEqual({ left: 0, width: 50 });
    expect(bar?.(b)).toEqual({ left: 25, width: 75 });
  });

  it("has no bar without dates", () => {
    expect(timelineSpan([{ startDate: null, targetDate: null }])).toBeNull();
    const bar = timelineSpan([
      { startDate: "2027-01-01T00:00:00.000Z", targetDate: null },
    ]);
    expect(bar?.({ startDate: null, targetDate: null })).toBeNull();
  });
});
