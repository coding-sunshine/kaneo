import { describe, expect, it } from "vite-plus/test";
import { localTime, zoneMidnight } from "./local-time";

describe("localTime", () => {
  const now = new Date("2026-03-10T02:30:00.000Z");

  it("reads the day and hour in the person's zone", () => {
    expect(localTime(now, "America/New_York")).toEqual({
      day: "2026-03-09",
      hour: 22,
    });
    expect(localTime(now, "Asia/Tokyo")).toEqual({
      day: "2026-03-10",
      hour: 11,
    });
  });

  it("falls back to UTC for a missing or unknown zone", () => {
    expect(localTime(now, null)).toEqual({ day: "2026-03-10", hour: 2 });
    expect(localTime(now, "Not/AZone")).toEqual({ day: "2026-03-10", hour: 2 });
  });

  it("finds where a local day starts", () => {
    expect(zoneMidnight("2026-03-10", "Asia/Kolkata").toISOString()).toBe(
      "2026-03-09T18:30:00.000Z",
    );
    expect(zoneMidnight("2026-03-10", "America/New_York").toISOString()).toBe(
      "2026-03-10T04:00:00.000Z",
    );
    expect(zoneMidnight("2026-03-10", null).toISOString()).toBe(
      "2026-03-10T00:00:00.000Z",
    );
  });
});
