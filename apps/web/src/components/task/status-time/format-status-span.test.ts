import { describe, expect, it } from "vite-plus/test";
import { formatStatusSpan } from "./format-status-span";

describe("formatStatusSpan", () => {
  it.each([
    [12_400, "12s"],
    [3 * 60_000, "3m"],
    [5 * 3_600_000, "5h"],
    [3 * 86_400_000, "3d"],
  ])("formats %i ms as %s", (ms, expected) => {
    expect(formatStatusSpan(ms, "en-US")).toBe(expected);
  });
});
