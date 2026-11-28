import { describe, expect, it } from "vite-plus/test";
import { titleSimilarity, titleWords } from "./title-similarity";

describe("titleSimilarity", () => {
  it("scores close titles high and unrelated ones low", () => {
    expect(
      titleSimilarity(
        "Login page crash in Safari",
        "Login page crashes on Safari",
      ),
    ).toBeGreaterThan(0.6);
    expect(
      titleSimilarity(
        "Login page crash in Safari",
        "Update billing email copy",
      ),
    ).toBeLessThan(0.2);
  });

  it("ignores case and punctuation, and is 0 for an empty title", () => {
    expect(titleSimilarity("Fix: LOGIN!", "fix login")).toBe(1);
    expect(titleSimilarity("", "fix login")).toBe(0);
  });

  it("splits titles into words", () => {
    expect(titleWords("Fix: Login-page")).toEqual(["fix", "login", "page"]);
  });
});
