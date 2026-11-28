import { describe, expect, it } from "vite-plus/test";
import { readProposal } from "./read-proposal";

const transcript =
  "Sam: Let's ship\n  on Friday.\nRiley: I'll write the notes.";

describe("readProposal", () => {
  it("keeps items whose quote was said, spacing aside", () => {
    expect(
      readProposal(
        JSON.stringify({
          decisions: [
            { text: "Ship Friday", quote: "Let's ship on Friday." },
            { text: "Made up", quote: "We agreed on Monday" },
          ],
          actionItems: [
            { title: "Write notes", quote: "I'll write the notes." },
          ],
        }),
        transcript,
      ),
    ).toEqual({
      decisions: [{ text: "Ship Friday", quote: "Let's ship on Friday." }],
      actionItems: [
        {
          title: "Write notes",
          description: "",
          quote: "I'll write the notes.",
        },
      ],
    });
  });

  it("is null for prose", () => {
    expect(readProposal("Here are the notes", transcript)).toBeNull();
  });
});
