import { describe, expect, it } from "vite-plus/test";
import { previewLines } from "./document-preview-lines";

describe("previewLines", () => {
  it("turns markdown into plain lines and marks headings", () => {
    const markdown = [
      "# Outcomes",
      "",
      "Some **bold** and _soft_ text with [a link](https://x.test) and `code`.",
      "",
      "- [ ] first item",
      "1. second item",
      "> a quote",
      "![diagram](https://x.test/a.png)",
      "---",
      "## Next steps",
    ].join("\n");
    expect(previewLines(markdown)).toEqual([
      { text: "Outcomes", heading: true },
      { text: "Some bold and soft text with a link and code.", heading: false },
      { text: "first item", heading: false },
      { text: "second item", heading: false },
      { text: "a quote", heading: false },
      { text: "Next steps", heading: true },
    ]);
  });

  it("stops after the given number of lines", () => {
    expect(previewLines("a\nb\nc\nd", 2)).toEqual([
      { text: "a", heading: false },
      { text: "b", heading: false },
    ]);
  });

  it("gives nothing for an empty document", () => {
    expect(previewLines("")).toEqual([]);
    expect(previewLines(null)).toEqual([]);
  });
});
