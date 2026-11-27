import { describe, expect, it } from "vite-plus/test";
import { markdownBlocks } from "./markdown-blocks";

describe("markdownBlocks", () => {
  it("reads headings, paragraphs, lists, code, quotes and rules", () => {
    const blocks = markdownBlocks(
      [
        "# Plan",
        "",
        "Some **bold** and `code` with a [link](https://example.com).",
        "Second line.",
        "",
        "## Steps",
        "- one",
        "  - nested",
        "1. first",
        "- [x] done",
        "",
        "> quoted",
        "",
        "```ts",
        "const a = 1;",
        "```",
        "",
        "---",
      ].join("\n"),
    );
    expect(blocks).toEqual([
      { type: "heading", level: 1, text: "Plan" },
      {
        type: "paragraph",
        text: "Some bold and code with a link (https://example.com). Second line.",
      },
      { type: "heading", level: 2, text: "Steps" },
      { type: "item", marker: "•", depth: 0, text: "one" },
      { type: "item", marker: "•", depth: 1, text: "nested" },
      { type: "item", marker: "1.", depth: 0, text: "first" },
      { type: "item", marker: "[x]", depth: 0, text: "done" },
      { type: "quote", text: "quoted" },
      { type: "code", text: "const a = 1;" },
      { type: "rule" },
    ]);
  });

  it("reads a pipe table with its header and rows", () => {
    const blocks = markdownBlocks(
      [
        "| Name | Owner |",
        "| --- | :---: |",
        "| API | **Ana** |",
        "| Web | Bo \\| Co |",
        "| CLI | one<br>two |",
      ].join("\n"),
    );
    expect(blocks).toEqual([
      {
        type: "table",
        header: ["Name", "Owner"],
        rows: [
          ["API", "Ana"],
          ["Web", "Bo | Co"],
          ["CLI", "one\ntwo"],
        ],
      },
    ]);
  });

  it("keeps a line with pipes but no separator row as a paragraph", () => {
    expect(markdownBlocks("a | b")).toEqual([
      { type: "paragraph", text: "a | b" },
    ]);
  });
});
