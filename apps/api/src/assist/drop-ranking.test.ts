import { describe, expect, it } from "vite-plus/test";
import { dropRanking, ranksPeople } from "./drop-ranking";

describe("dropRanking", () => {
  it("drops bullets that rank or compare people", () => {
    expect(ranksPeople("Avery was the most active person")).toBe(true);
    expect(ranksPeople("Blair was least engaged this week")).toBe(true);
    expect(ranksPeople("Top contributors: Avery")).toBe(true);
    expect(
      dropRanking([
        { text: "The vendor was chosen" },
        { text: "Ranking: A, B" },
      ]),
    ).toEqual([{ text: "The vendor was chosen" }]);
  });

  it("keeps ordinary work updates", () => {
    expect(ranksPeople("The most urgent bug is fixed")).toBe(false);
    expect(ranksPeople("Avery shipped checkout")).toBe(false);
  });
});
