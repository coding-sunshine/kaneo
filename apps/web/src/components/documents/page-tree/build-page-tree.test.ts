import { describe, expect, it } from "vite-plus/test";
import { buildPageTree, dropParent } from "./build-page-tree";

const row = (id: string, parentDocumentId: string | null = null) => ({
  id,
  title: id,
  icon: null,
  parentDocumentId,
});

const rows = [
  row("handbook"),
  row("onboarding", "handbook"),
  row("laptop", "onboarding"),
  row("policies"),
];

describe("buildPageTree", () => {
  it("nests each page under its parent, in the order given", () => {
    const tree = buildPageTree(rows);
    expect(tree.map((node) => node.id)).toEqual(["handbook", "policies"]);
    expect(tree[0]?.children.map((node) => node.id)).toEqual(["onboarding"]);
    expect(tree[0]?.children[0]?.children.map((node) => node.id)).toEqual([
      "laptop",
    ]);
  });

  it("shows a page at the top when its parent is not in the list", () => {
    const tree = buildPageTree([row("orphan", "gone")]);
    expect(tree.map((node) => node.id)).toEqual(["orphan"]);
  });
});

describe("dropParent", () => {
  it("puts the page under the page it is dropped on", () => {
    expect(dropParent(rows, "onboarding", "policies")).toBe("policies");
  });

  it("puts the page at the top when dropped on the top", () => {
    expect(dropParent(rows, "onboarding", "root")).toBeNull();
  });

  it("refuses the page itself, a page below it, and its current parent", () => {
    expect(dropParent(rows, "handbook", "handbook")).toBeUndefined();
    expect(dropParent(rows, "handbook", "laptop")).toBeUndefined();
    expect(dropParent(rows, "onboarding", "handbook")).toBeUndefined();
    expect(dropParent(rows, "handbook", "root")).toBeUndefined();
  });
});
