import { describe, expect, it } from "vite-plus/test";
import { nextRunAfter } from "./schedule";

const from = new Date("2026-01-15T10:30:00.000Z");

describe("nextRunAfter", () => {
  it.each([
    ["hourly", "2026-01-15T11:30:00.000Z"],
    ["daily", "2026-01-16T10:30:00.000Z"],
    ["weekly", "2026-01-22T10:30:00.000Z"],
    ["monthly", "2026-02-15T10:30:00.000Z"],
    ["yearly", "2027-01-15T10:30:00.000Z"],
  ] as const)("%s", (frequency, expected) => {
    expect(nextRunAfter(frequency, from).toISOString()).toBe(expected);
  });
});
