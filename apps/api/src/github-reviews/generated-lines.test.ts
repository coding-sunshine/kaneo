import { describe, expect, it } from "vite-plus/test";
import { generatedLines } from "./generated-lines";

const file = (path: string, additions: number, deletions = 0) => ({
  path,
  additions,
  deletions,
});

describe("generatedLines", () => {
  it("sums generated files only", () => {
    const nodes = [
      file("src/a.ts", 5),
      file("pnpm-lock.yaml", 400, 20),
      file("web/dist/x.js", 10),
    ];
    expect(generatedLines({ totalCount: 3, nodes })).toEqual({
      additions: 410,
      deletions: 20,
    });
  });

  it("gives up when files were cut off", () => {
    expect(
      generatedLines({ totalCount: 60, nodes: [file("a", 1)] }),
    ).toBeNull();
    expect(generatedLines(undefined)).toBeNull();
  });
});
