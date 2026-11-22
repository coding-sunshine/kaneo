import { describe, expect, it } from "vite-plus/test";
import { groupChatsByRecency } from "./group-chats";

describe("groupChatsByRecency", () => {
  it("buckets by recency and drops empty buckets", () => {
    const now = new Date(2026, 5, 15, 12);
    const at = (days: number) => ({
      updatedAt: new Date(2026, 5, 15 - days, 9).toISOString(),
    });
    const groups = groupChatsByRecency([at(0), at(1), at(3), at(30)], now);
    expect(groups.map((group) => group.key)).toEqual([
      "today",
      "yesterday",
      "week",
      "older",
    ]);
    expect(groupChatsByRecency([at(1)], now).map((g) => g.key)).toEqual([
      "yesterday",
    ]);
  });
});
