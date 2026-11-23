import { describe, expect, it } from "vite-plus/test";
import { shortAge } from "./short-age";

const now = Date.parse("2026-03-10T12:00:00Z");
const ago = (seconds: number) => new Date(now - seconds * 1000).toISOString();

describe("shortAge", () => {
  it("picks the largest whole unit", () => {
    expect(shortAge(ago(30), now)).toBe("now");
    expect(shortAge(ago(90), now)).toBe("1m");
    expect(shortAge(ago(5 * 3600), now)).toBe("5h");
    expect(shortAge(ago(3 * 86_400), now)).toBe("3d");
    expect(shortAge(ago(63 * 86_400), now)).toBe("9w");
  });

  it("treats future times as now", () => {
    expect(shortAge(ago(-600), now)).toBe("now");
  });
});
