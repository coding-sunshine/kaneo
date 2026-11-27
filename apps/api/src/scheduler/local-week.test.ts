import { describe, expect, it } from "vite-plus/test";
import { localWeek } from "./local-week";

describe("localWeek", () => {
  it("starts the week on the local Monday", () => {
    expect(localWeek(new Date("2026-12-02T12:00:00Z"), "UTC")).toEqual({
      weekend: false,
      week: "2026-11-30",
    });
  });

  it("marks Saturday and Sunday as the weekend of the same week", () => {
    expect(localWeek(new Date("2026-12-05T12:00:00Z"), "UTC")).toEqual({
      weekend: true,
      week: "2026-11-30",
    });
    expect(localWeek(new Date("2026-12-06T23:59:00Z"), "UTC")).toEqual({
      weekend: true,
      week: "2026-11-30",
    });
  });

  it("reads the day in the person's timezone", () => {
    const sundayInUtc = new Date("2026-11-29T20:00:00Z");
    expect(localWeek(sundayInUtc, "Asia/Tokyo")).toEqual({
      weekend: false,
      week: "2026-11-30",
    });
    const mondayInUtc = new Date("2026-11-30T05:00:00Z");
    expect(localWeek(mondayInUtc, "America/Los_Angeles")).toEqual({
      weekend: true,
      week: "2026-11-23",
    });
  });

  it("falls back to UTC for an unknown timezone", () => {
    expect(localWeek(new Date("2026-12-01T00:00:00Z"), "Not/AZone")).toEqual({
      weekend: false,
      week: "2026-11-30",
    });
  });
});
