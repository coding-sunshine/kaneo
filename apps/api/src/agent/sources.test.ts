import { describe, expect, it } from "vite-plus/test";
import { grounded, splitSources } from "./sources";

describe("splitSources", () => {
  it("takes the ids it names out of the answer's text", () => {
    expect(
      splitSources(
        "The retry waits on legal (comment:k3j9x2m8q7w1e5r4t6y0u2i8).\n\nSources: comment:k3j9x2m8q7w1e5r4t6y0u2i8",
      ).text,
    ).toBe("The retry waits on legal.");
  });

  it("takes the sources off the last line", () => {
    expect(
      splitSources(
        "SLUG-1 waits on SLUG-2.\n\nSources: task:abc123 comment:c9 task:abc123",
      ),
    ).toEqual({
      text: "SLUG-1 waits on SLUG-2.",
      cited: [
        { kind: "task", id: "abc123" },
        { kind: "comment", id: "c9" },
      ],
    });
  });

  it("reads a line the model wrapped in Markdown", () => {
    expect(
      splitSources("Done.\n**Sources:** `document:d1`, task: t2").cited,
    ).toEqual([
      { kind: "document", id: "d1" },
      { kind: "task", id: "t2" },
    ]);
  });

  it("finds no source in `none` or without the line", () => {
    expect(splitSources("I cannot tell.\nSources: none")).toEqual({
      text: "I cannot tell.",
      cited: [],
    });
    expect(splitSources("No line here.")).toEqual({
      text: "No line here.",
      cited: [],
    });
  });

  it("leaves a line that only mentions sources earlier in the text", () => {
    const text = "Sources: task:a1 are listed below.\nThe end.";
    expect(splitSources(text)).toEqual({ text, cited: [] });
  });

  it("keeps a last line that starts with the word but names no sources", () => {
    const text = "Done.\nSources say the vendor is late.";
    expect(splitSources(text)).toEqual({ text, cited: [] });
  });
});

describe("grounded", () => {
  it("keeps only ids a tool returned", () => {
    expect(
      grounded(
        [
          { kind: "task", id: "read1" },
          { kind: "task", id: "made-up" },
        ],
        ['{"id":"read1","title":"x"}'],
      ),
    ).toEqual([{ kind: "task", id: "read1" }]);
  });

  it("does not take part of a longer id for the id", () => {
    expect(
      grounded(
        [
          { kind: "task", id: "abc" },
          { kind: "task", id: "c1" },
          { kind: "task", id: "x-1" },
        ],
        ['{"id":"abcdef","taskId":"c12"} x-12'],
      ),
    ).toEqual([]);
  });
});
