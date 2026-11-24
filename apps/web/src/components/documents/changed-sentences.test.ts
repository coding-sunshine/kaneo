import { describe, expect, it } from "vite-plus/test";
import { changedSentences, sentencesOf } from "./changed-sentences";

describe("changedSentences", () => {
  it("reads sentences out of markdown and HTML", () => {
    expect(
      sentencesOf(
        "# Launch plan\n\n- [x] Ship on **Monday**. Tell sales.\n> 1. Price is $40.\n<p>Stock is ready.</p><p>Ads start later.</p>",
      ),
    ).toEqual([
      "Launch plan",
      "Ship on Monday.",
      "Tell sales.",
      "Price is $40.",
      "Stock is ready.",
      "Ads start later.",
    ]);
  });

  it("reports what was added and what was removed", () => {
    const before = "We ship on Monday. Price is $40. Sales knows.";
    const after =
      "We ship on Friday. Price is $40. Sales knows. Ads start later.";
    expect(changedSentences(before, after)).toEqual({
      added: ["We ship on Friday.", "Ads start later."],
      removed: ["We ship on Monday."],
      count: 2,
    });
  });

  it("counts a sentence that was said twice and is now said once", () => {
    expect(changedSentences("Yes. Yes. No.", "Yes. No.")).toEqual({
      added: [],
      removed: ["Yes."],
      count: 1,
    });
  });

  it("reports nothing when only the order or the markup changed", () => {
    expect(
      changedSentences(
        "## Plan\n\nFirst this. Then that.",
        "Then that.\n\n**First this.**\n\nPlan",
      ),
    ).toEqual({ added: [], removed: [], count: 0 });
  });
});
