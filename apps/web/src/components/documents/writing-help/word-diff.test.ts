import { describe, expect, it } from "vite-plus/test";
import { wordDiff } from "./word-diff";

describe("wordDiff", () => {
  it("keeps shared words and marks what was taken out and put in", () => {
    expect(
      wordDiff("we agreed the launch should move", "the launch moves"),
    ).toEqual([
      { kind: "removed", text: "we agreed " },
      { kind: "same", text: "the launch " },
      { kind: "removed", text: "should move" },
      { kind: "added", text: "moves" },
    ]);
  });

  it("reads unchanged text as one kept part", () => {
    expect(wordDiff("same text", "same text")).toEqual([
      { kind: "same", text: "same text" },
    ]);
  });
});
