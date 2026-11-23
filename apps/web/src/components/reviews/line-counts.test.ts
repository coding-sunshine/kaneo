import { describe, expect, it } from "vite-plus/test";
import type { Category } from "./file-categories";
import { lineCounts } from "./line-counts";

const file = (filename: string, additions: number, deletions: number) => ({
  filename,
  additions,
  deletions,
});
const byName = (path: string): Category =>
  path.endsWith(".test.ts")
    ? "test"
    : path.endsWith(".md")
      ? "documentation"
      : path.includes("gen")
        ? "generated"
        : "implementation";

describe("lineCounts", () => {
  it("counts implementation only and flags the difference", () => {
    const result = lineCounts(
      [file("a.ts", 3, 1), file("a.test.ts", 10, 0), file("r.md", 2, 2)],
      byName,
    );
    expect(result.implementation).toEqual({ additions: 3, deletions: 1 });
    expect(result.total).toEqual({ additions: 15, deletions: 3 });
    expect(result.differs).toBe(true);
    expect(result.generatedOnly).toBe(false);
  });

  it("matches when nothing is excluded", () => {
    const result = lineCounts([file("a.ts", 3, 1)], byName);
    expect(result.differs).toBe(false);
  });

  it("is generated-only when every changed line is generated", () => {
    expect(lineCounts([file("gen.ts", 5, 5)], byName).generatedOnly).toBe(true);
    expect(
      lineCounts([file("gen.ts", 5, 5), file("a.ts", 1, 0)], byName)
        .generatedOnly,
    ).toBe(false);
    expect(lineCounts([], byName).generatedOnly).toBe(false);
  });
});
