import { describe, expect, it } from "vite-plus/test";
import { groupCommentThreads } from "./group-comment-threads";

describe("groupCommentThreads", () => {
  it("moves replies under their top-level comment in order", () => {
    const { items, repliesByRoot } = groupCommentThreads([
      { id: "root", parentId: null },
      { id: "event" },
      { id: "r1", parentId: "root" },
      { id: "r2", parentId: "root" },
    ]);
    expect(items.map((item) => item.id)).toEqual(["root", "event"]);
    expect(repliesByRoot.get("root")?.map((item) => item.id)).toEqual([
      "r1",
      "r2",
    ]);
  });

  it("keeps a reply whose parent is not loaded", () => {
    const { items } = groupCommentThreads([{ id: "r1", parentId: "gone" }]);
    expect(items.map((item) => item.id)).toEqual(["r1"]);
  });
});
