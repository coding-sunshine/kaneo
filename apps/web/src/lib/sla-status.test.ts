import { describe, expect, it } from "vite-plus/test";
import { getSlaStatus } from "./sla-status";

const now = Date.parse("2026-01-10T00:00:00Z");
const due = (ms: number) => new Date(now + ms).toISOString();
const DAY = 86_400_000;

describe("getSlaStatus", () => {
  it("is null without an SLA", () => {
    expect(getSlaStatus({ slaDueAt: null }, now)).toBeNull();
  });

  it("grades risk by time left", () => {
    expect(getSlaStatus({ slaDueAt: due(8 * DAY) }, now)).toBe("low");
    expect(getSlaStatus({ slaDueAt: due(7 * DAY) }, now)).toBe("medium");
    expect(getSlaStatus({ slaDueAt: due(DAY) }, now)).toBe("high");
    expect(getSlaStatus({ slaDueAt: due(0) }, now)).toBe("breached");
    expect(getSlaStatus({ slaDueAt: due(-DAY) }, now)).toBe("breached");
  });

  it("keeps the verdict once completed", () => {
    expect(
      getSlaStatus({ slaDueAt: due(-DAY), completedAt: due(-2 * DAY) }, now),
    ).toBe("achieved");
    expect(
      getSlaStatus({ slaDueAt: due(-2 * DAY), completedAt: due(-DAY) }, now),
    ).toBe("failed");
  });
});
