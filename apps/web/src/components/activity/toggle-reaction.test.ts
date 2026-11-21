import { describe, expect, it } from "vite-plus/test";
import { toggleReaction } from "./toggle-reaction";

describe("toggleReaction", () => {
  const reactions = [
    { emoji: "👍", userIds: ["a"] },
    { emoji: "🎉", userIds: ["b"] },
  ];

  it("appends a new emoji at the end", () => {
    expect(toggleReaction(reactions, "👀", "a", true)).toEqual([
      ...reactions,
      { emoji: "👀", userIds: ["a"] },
    ]);
  });

  it("adds a user once to an existing emoji", () => {
    expect(toggleReaction(reactions, "👍", "a", true)[0]).toEqual({
      emoji: "👍",
      userIds: ["a"],
    });
    expect(toggleReaction(reactions, "👍", "b", true)[0].userIds).toEqual([
      "a",
      "b",
    ]);
  });

  it("drops an emoji when its last user removes it", () => {
    expect(toggleReaction(reactions, "👍", "a", false)).toEqual([reactions[1]]);
  });
});
