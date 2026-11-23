import { describe, expect, it } from "vite-plus/test";
import { isCommentOnLine, parsePatch, toSplitRows } from "./diff-parser";

const PATCH = [
  "@@ -10,4 +20,5 @@ fn",
  " keep",
  "-old one",
  "-old two",
  "+new one",
  "+new two",
  "+new three",
  " tail",
  "\\ No newline at end of file",
  "@@ -40 +50 @@",
  "-x",
  "+y",
].join("\n");

describe("parsePatch", () => {
  it("numbers old and new lines from each hunk header", () => {
    const lines = parsePatch("@@ -10,3 +20,3 @@ fn\n keep\n-old\n+new");
    expect(lines.map((line) => [line.kind, line.oldNo, line.newNo])).toEqual([
      ["hunk", null, null],
      ["ctx", 10, 20],
      ["del", 11, null],
      ["add", null, 21],
    ]);
  });

  it("restarts numbering at a later hunk and keeps the no-newline marker unnumbered", () => {
    const lines = parsePatch(PATCH);
    expect(lines[8]).toMatchObject({ kind: "ctx", oldNo: null, newNo: null });
    expect(lines[10]).toMatchObject({ kind: "del", oldNo: 40 });
    expect(lines[11]).toMatchObject({ kind: "add", newNo: 50 });
  });

  it("counts the unchanged lines above each hunk", () => {
    const hunks = parsePatch(PATCH).filter((line) => line.kind === "hunk");
    expect(hunks.map((hunk) => hunk.skipped)).toEqual([9, 26]);
    expect(parsePatch("@@ -0,0 +1,2 @@\n+a\n+b")[0].skipped).toBe(0);
    expect(parsePatch("@@ -1,2 +1,2 @@\n a\n-b\n+c")[0].skipped).toBe(0);
  });

  it("strips the diff marker from the text", () => {
    expect(parsePatch("@@ -1 +1 @@\n-a\n+b\n c").map((l) => l.text)).toEqual([
      "@@ -1 +1 @@",
      "a",
      "b",
      "c",
    ]);
  });
});

describe("toSplitRows", () => {
  const rows = toSplitRows(parsePatch(PATCH));

  it("puts context on both sides and pairs removals with additions", () => {
    const shape = rows.map((row) =>
      row.kind === "hunk"
        ? "hunk"
        : `${row.left?.text ?? "-"}|${row.right?.text ?? "-"}`,
    );
    expect(shape).toEqual([
      "hunk",
      "keep|keep",
      "old one|new one",
      "old two|new two",
      "-|new three",
      "tail|tail",
      "\\ No newline at end of file|\\ No newline at end of file",
      "hunk",
      "x|y",
    ]);
  });

  it("gives every row a unique id for keys", () => {
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
  });

  it("leaves a removal with no addition opposite an empty cell", () => {
    const [, row] = toSplitRows(parsePatch("@@ -1,2 +1 @@\n-gone\n keep"));
    expect(row).toMatchObject({ kind: "pair", right: null });
  });
});

describe("isCommentOnLine", () => {
  const [, ctx, del, add] = parsePatch("@@ -5,2 +5,2 @@\n keep\n-a\n+b");
  const on = (line: number, side: "LEFT" | "RIGHT" | null) => ({
    path: "f",
    line,
    side,
  });

  it("matches the new number on the right and the old number on the left", () => {
    expect(isCommentOnLine(on(6, "RIGHT"), add, "RIGHT")).toBe(true);
    expect(isCommentOnLine(on(6, "LEFT"), del, "LEFT")).toBe(true);
    expect(isCommentOnLine(on(6, "LEFT"), add, "LEFT")).toBe(false);
    expect(isCommentOnLine(on(5, "RIGHT"), ctx, "RIGHT")).toBe(true);
  });

  it("treats a missing side as right and ignores outdated comments", () => {
    expect(isCommentOnLine(on(6, null), add, "RIGHT")).toBe(true);
    expect(
      isCommentOnLine({ path: "f", line: null, side: "RIGHT" }, add, "RIGHT"),
    ).toBe(false);
    expect(isCommentOnLine(on(6, "RIGHT"), null, "RIGHT")).toBe(false);
  });
});
