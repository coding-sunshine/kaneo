import { describe, expect, it } from "vite-plus/test";

import { childPages, flattenPageTree } from "./page-tree";

const page = (id: string, title: string, parentDocumentId: string | null) => ({
  id,
  title,
  icon: null,
  parentDocumentId,
});

describe("flattenPageTree", () => {
  it("lists each page under its parent, sorted by title, with its depth", () => {
    const rows = flattenPageTree([
      page("b", "Beta", null),
      page("a2", "Setup", "a"),
      page("a", "Alpha", null),
      page("a1", "Intro", "a"),
      page("a1x", "Deep", "a1"),
    ]);
    expect(rows.map((r) => [r.page.id, r.depth])).toEqual([
      ["a", 0],
      ["a1", 1],
      ["a1x", 2],
      ["a2", 1],
      ["b", 0],
    ]);
  });

  it("shows a page whose parent you cannot open at the top", () => {
    const rows = flattenPageTree([page("x", "Orphan", "hidden")]);
    expect(rows).toEqual([{ page: page("x", "Orphan", "hidden"), depth: 0 }]);
  });

  it("survives a parent loop without repeating pages", () => {
    const rows = flattenPageTree([page("a", "A", "b"), page("b", "B", "a")]);
    expect(rows.map((r) => r.page.id).sort()).toEqual(["a", "b"]);
  });
});

describe("childPages", () => {
  it("lists the pages right under one page", () => {
    const tree = [
      page("a", "A", null),
      page("c", "C", "a"),
      page("b", "B", "a"),
    ];
    expect(childPages(tree, "a").map((p) => p.id)).toEqual(["b", "c"]);
  });
});
