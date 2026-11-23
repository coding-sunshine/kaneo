import { describe, expect, it } from "vite-plus/test";
import { arrangeFiles, buildTree } from "./arrange-files";
import type { Category } from "./file-categories";

const f = (filename: string, additions = 1, deletions = 0) => ({
  filename,
  additions,
  deletions,
});
const cat = (p: string): Category =>
  p.endsWith(".test.ts") ? "test" : "implementation";
const names = (sections: { files: { filename: string }[] }[]) =>
  sections.map((s) => s.files.map((x) => x.filename));

describe("arrangeFiles", () => {
  const files = [f("b.ts", 5), f("a.test.ts", 1), f("c.ts", 3, 3)];
  it("orders by path or changed lines, either way", () => {
    const base = { group: "none", desc: false } as const;
    expect(names(arrangeFiles(files, cat, { ...base, order: "path" }))).toEqual(
      [["a.test.ts", "b.ts", "c.ts"]],
    );
    expect(
      names(
        arrangeFiles(files, cat, { ...base, order: "changes", desc: true }),
      ),
    ).toEqual([["c.ts", "b.ts", "a.test.ts"]]);
  });
  it("groups by category in a fixed order", () => {
    const out = arrangeFiles(files, cat, {
      order: "path",
      desc: false,
      group: "type",
    });
    expect(out.map((s) => s.category)).toEqual(["implementation", "test"]);
    expect(names(out)).toEqual([["b.ts", "c.ts"], ["a.test.ts"]]);
  });
});

describe("buildTree", () => {
  it("nests folders and joins single-folder chains", () => {
    const tree = buildTree([
      f("a/b/c/x.ts"),
      f("a/b/c/y.ts"),
      f("a/z.ts"),
      f("top.ts"),
    ]);
    expect(tree).toHaveLength(2);
    const dir = tree[0];
    if (dir.kind !== "dir") throw new Error("dir");
    expect(dir.name).toBe("a");
    expect(dir.children.map((n) => n.name)).toEqual(["b/c", "z.ts"]);
  });
});
