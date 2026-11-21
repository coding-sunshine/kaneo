import { describe, expect, it } from "vite-plus/test";
import { groupReactions } from "./group-reactions";

describe("groupReactions", () => {
  it("groups by comment then emoji, keeping first-use order", () => {
    const reactionsFor = groupReactions([
      { activityId: "a", userId: "u1", emoji: "👍" },
      { activityId: "b", userId: "u1", emoji: "🎉" },
      { activityId: "a", userId: "u2", emoji: "❤️" },
      { activityId: "a", userId: "u3", emoji: "👍" },
    ]);
    expect(reactionsFor("a")).toEqual([
      { emoji: "👍", userIds: ["u1", "u3"] },
      { emoji: "❤️", userIds: ["u2"] },
    ]);
    expect(reactionsFor("b")).toEqual([{ emoji: "🎉", userIds: ["u1"] }]);
    expect(reactionsFor("none")).toEqual([]);
  });
});
