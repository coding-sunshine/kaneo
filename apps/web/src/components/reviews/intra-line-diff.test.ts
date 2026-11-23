import { describe, expect, it } from "vite-plus/test";
import { parsePatch } from "./diff-parser";
import { markChanges, pairChanges } from "./intra-line-diff";

describe("markChanges", () => {
  it("marks only the changed words", () => {
    const out = markChanges("const a = 1;", "const a = 22;");
    expect(out?.del).toEqual([
      { text: "const a = ", changed: false },
      { text: "1", changed: true },
      { text: ";", changed: false },
    ]);
    expect(out?.add.filter((s) => s.changed).map((s) => s.text)).toEqual([
      "22",
    ]);
  });
  it("leaves a fully different line to the line colour", () => {
    expect(markChanges("abc", "xyz")).toBeNull();
  });
});

describe("pairChanges", () => {
  it("pairs removals with additions inside a run", () => {
    const lines = parsePatch("@@ -1,2 +1,2 @@\n ctx\n-let x = 1\n+let x = 2");
    const map = pairChanges(lines);
    expect([...map.keys()]).toEqual([2, 3]);
    expect(map.get(3)?.some((s) => s.changed && s.text === "2")).toBe(true);
  });
});
