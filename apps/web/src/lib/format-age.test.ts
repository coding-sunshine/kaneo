import { describe, expect, it } from "vite-plus/test";
import { formatAge } from "./format-age";

const now = Date.parse("2026-01-10T12:00:00Z");
const ago = (ms: number) => new Date(now - ms).toISOString();

describe("formatAge", () => {
  it("counts minutes under an hour", () => {
    expect(formatAge(ago(5 * 60_000), now, "en-US")).toBe("5m");
  });

  it("counts hours under two days", () => {
    expect(formatAge(ago(30 * 3_600_000), now, "en-US")).toBe("30h");
  });

  it("counts days after that", () => {
    expect(formatAge(ago(3 * 86_400_000), now, "en-US")).toBe("3d");
  });

  it("never goes negative for a clock ahead of this one", () => {
    expect(formatAge(new Date(now + 60_000).toISOString(), now, "en-US")).toBe(
      "0m",
    );
  });
});
