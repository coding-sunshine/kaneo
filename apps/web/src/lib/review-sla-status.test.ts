import { describe, expect, it } from "vite-plus/test";
import { getReviewSlaStatus } from "./review-sla-status";

const HOUR = 3_600_000;
const now = Date.parse("2026-01-10T12:00:00Z");
const dueIn = (hours: number) => new Date(now + hours * HOUR).toISOString();

describe("getReviewSlaStatus", () => {
  it("shows no risk on a fresh two-day review", () => {
    expect(getReviewSlaStatus(dueIn(48), now)).toBeNull();
    expect(getReviewSlaStatus(dueIn(25), now)).toBeNull();
  });

  it("raises the risk as the due time nears, then breaches", () => {
    expect(getReviewSlaStatus(dueIn(20), now)).toBe("medium");
    expect(getReviewSlaStatus(dueIn(4), now)).toBe("high");
    expect(getReviewSlaStatus(dueIn(0), now)).toBe("breached");
    expect(getReviewSlaStatus(dueIn(-3), now)).toBe("breached");
  });

  it("has no status without a due time", () => {
    expect(getReviewSlaStatus(null, now)).toBeNull();
  });
});
