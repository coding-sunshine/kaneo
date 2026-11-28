import { describe, expect, it } from "vite-plus/test";
import { parseBlocks, parseInline } from "./parse-message-markdown";

describe("parseBlocks", () => {
  it("keeps a plain message as one paragraph with its line breaks", () => {
    expect(parseBlocks("hello\nthere")).toEqual([
      { type: "paragraph", text: "hello\nthere" },
    ]);
  });

  it("reads a fenced code block with its language", () => {
    expect(
      parseBlocks("before\n```ts\nconst a = 1;\nconst b = 2;\n```\nafter"),
    ).toEqual([
      { type: "paragraph", text: "before" },
      { type: "code", language: "ts", code: "const a = 1;\nconst b = 2;" },
      { type: "paragraph", text: "after" },
    ]);
  });

  it("leaves an unclosed fence as text", () => {
    expect(parseBlocks("```ts\nconst a = 1;")).toEqual([
      { type: "paragraph", text: "```ts\nconst a = 1;" },
    ]);
  });

  it("reads bulleted and numbered lists", () => {
    expect(parseBlocks("- one\n* two\n\n1. first\n2. second")).toEqual([
      { type: "list", ordered: false, items: ["one", "two"] },
      { type: "list", ordered: true, items: ["first", "second"] },
    ]);
  });

  it("reads a quote and the blocks inside it", () => {
    expect(parseBlocks("> said\n> - a point\nreply")).toEqual([
      {
        type: "quote",
        blocks: [
          { type: "paragraph", text: "said" },
          { type: "list", ordered: false, items: ["a point"] },
        ],
      },
      { type: "paragraph", text: "reply" },
    ]);
  });
});

describe("parseInline", () => {
  it("reads bold and inline code", () => {
    expect(parseInline("a **bold** and `x * y` end")).toEqual([
      { type: "text", text: "a " },
      { type: "strong", children: [{ type: "text", text: "bold" }] },
      { type: "text", text: " and " },
      { type: "code", text: "x * y" },
      { type: "text", text: " end" },
    ]);
  });

  it("leaves a lone marker and code marks inside a link as text", () => {
    expect(parseInline("2 ** 3 at https://example.test/**a**")).toEqual([
      { type: "text", text: "2 ** 3 at https://example.test/**a**" },
    ]);
  });

  it("does not format inside a mention tag", () => {
    const tag = '<kaneo-mention id="u**1**"></kaneo-mention>';
    expect(parseInline(`hi ${tag}`)).toEqual([
      { type: "text", text: `hi ${tag}` },
    ]);
  });
});
