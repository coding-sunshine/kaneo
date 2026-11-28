import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import { generatedLines } from "./generated-lines";

function generatedPathLine(path: URL) {
  const text = readFileSync(path, "utf8");
  const start = text.indexOf("export const GENERATED_PATH =");
  const end = start < 0 ? -1 : text.indexOf(";", start);
  if (start < 0 || end < 0) {
    throw new Error(`GENERATED_PATH missing in ${path.pathname}`);
  }
  return text.slice(start, end + 1).replace(/\s+/g, " ");
}

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

  it("uses the same generated-path pattern as the web heuristic", () => {
    expect(
      generatedPathLine(new URL("./generated-lines.ts", import.meta.url)),
    ).toBe(
      generatedPathLine(
        new URL(
          "../../../web/src/components/reviews/file-categories.ts",
          import.meta.url,
        ),
      ),
    );
  });

  it("gives up when files were cut off", () => {
    expect(
      generatedLines({ totalCount: 60, nodes: [file("a", 1)] }),
    ).toBeNull();
    expect(generatedLines(undefined)).toBeNull();
  });
});
