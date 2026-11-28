import { describe, expect, it } from "vite-plus/test";
import { assistantReplyBody } from "./assistant-reply-body";

const link = (id: string) => (id === "PAY-1" ? id : `https://app/m/${id}`);

describe("assistantReplyBody", () => {
  it("lists the summary, then what is open, each with its links", () => {
    expect(
      assistantReplyBody(
        {
          summary: [{ text: "@here It fails.", sources: ["m1", "PAY-1"] }],
          open: [{ text: "Pick a fix.", sources: ["m2"] }],
        },
        link,
      ),
    ).toBe(
      [
        "**Summary**",
        "- here It fails. https://app/m/m1 PAY-1",
        "**Still open**",
        "- Pick a fix. https://app/m/m2",
      ].join("\n"),
    );
  });

  it("says when nothing is open, and when there was nothing to sum up", () => {
    expect(
      assistantReplyBody(
        { summary: [{ text: "Done.", sources: ["m1"] }], open: [] },
        link,
      ),
    ).toBe(
      [
        "**Summary**",
        "- Done. https://app/m/m1",
        "**Still open**",
        "- Nothing.",
      ].join("\n"),
    );
    expect(assistantReplyBody({ summary: [], open: [] }, link)).toBe(
      "I found nothing in this thread to sum up.",
    );
  });
});
