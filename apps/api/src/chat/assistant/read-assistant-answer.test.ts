import { describe, expect, it } from "vite-plus/test";
import { readAssistantAnswer } from "./read-assistant-answer";

const given = new Set(["m1", "PAY-1"]);

describe("readAssistantAnswer", () => {
  it("reads the summary and the open items, also inside a code fence", () => {
    const text = `\`\`\`json\n${JSON.stringify({
      summary: [{ text: "It fails.", sources: ["m1", "PAY-1"] }],
      open: [{ text: "Pick a fix.", sources: ["m1"] }],
    })}\n\`\`\``;
    expect(readAssistantAnswer(text, given)).toEqual({
      summary: [{ text: "It fails.", sources: ["m1", "PAY-1"] }],
      open: [{ text: "Pick a fix.", sources: ["m1"] }],
    });
  });

  it("keeps only given ids and drops an item left with none", () => {
    const text = JSON.stringify({
      summary: [
        { text: "Made up.", sources: ["SEC-1"] },
        { text: "Real.", sources: ["SEC-1", "m1", "m1"] },
      ],
    });
    expect(readAssistantAnswer(text, given)).toEqual({
      summary: [{ text: "Real.", sources: ["m1"] }],
      open: [],
    });
  });

  it("keeps five items per list and five sources per item", () => {
    const many = Array.from({ length: 8 }, (_, n) => `m${n}`);
    const text = JSON.stringify({
      summary: many.map((id) => ({ text: id, sources: many })),
    });
    const answer = readAssistantAnswer(text, new Set(many));
    expect(answer?.summary).toHaveLength(5);
    expect(answer?.summary[0]?.sources).toEqual(["m0", "m1", "m2", "m3", "m4"]);
  });

  it("is null when the answer is not the JSON asked for", () => {
    expect(readAssistantAnswer("Here is a summary.", given)).toBeNull();
    expect(readAssistantAnswer('{"summary":"text"}', given)).toBeNull();
  });

  it("takes the message ids the model wrote into its text out of it", () => {
    const id = "k3j9x2m8q7w1e5r4t6y0u2i8";
    const text = JSON.stringify({
      summary: [{ text: `It fails, as [${id}] says.`, sources: [id] }],
      open: [],
    });
    expect(readAssistantAnswer(text, new Set([id]))?.summary).toEqual([
      { text: "It fails, as says.", sources: [id] },
    ]);
  });
});
