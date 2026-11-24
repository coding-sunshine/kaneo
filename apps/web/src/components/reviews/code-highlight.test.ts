import { describe, expect, it } from "vite-plus/test";
import { languageFor, layerPieces } from "@/components/reviews/code-highlight";

describe("languageFor", () => {
  it("maps extensions and special names", () => {
    expect(languageFor("src/a/b.ts")).toBe("ts");
    expect(languageFor("ci.yml")).toBe("yaml");
    expect(languageFor("tools/Makefile")).toBe("makefile");
    expect(languageFor("LICENSE")).toBeNull();
    expect(languageFor(".gitignore")).toBeNull();
  });
});

describe("layerPieces", () => {
  it("keeps token colours when nothing changed", () => {
    expect(
      layerPieces([
        { content: "const", color: "#a" },
        { content: " x", color: "#b" },
      ]),
    ).toEqual([
      { text: "const", color: "#a", changed: false },
      { text: " x", color: "#b", changed: false },
    ]);
  });

  it("splits a token at the edge of a changed word", () => {
    expect(
      layerPieces(
        [{ content: "foo bar", color: "#a" }],
        [
          { text: "foo ", changed: false },
          { text: "bar", changed: true },
        ],
      ),
    ).toEqual([
      { text: "foo ", color: "#a", changed: false },
      { text: "bar", color: "#a", changed: true },
    ]);
  });

  it("splits across several tokens", () => {
    const pieces = layerPieces(
      [{ content: "ab" }, { content: "cd" }],
      [
        { text: "a", changed: false },
        { text: "bc", changed: true },
        { text: "d", changed: false },
      ],
    );
    expect(pieces.map((piece) => [piece.text, piece.changed])).toEqual([
      ["a", false],
      ["b", true],
      ["c", true],
      ["d", false],
    ]);
  });
});
