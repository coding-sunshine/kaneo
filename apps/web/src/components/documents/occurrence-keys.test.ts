import { describe, expect, it } from "vite-plus/test";
import { occurrenceKeys } from "./occurrence-keys";

describe("occurrenceKeys", () => {
  it("numbers repeats so every key is unique", () => {
    expect(occurrenceKeys(["a", "b", "a", "a"])).toEqual([
      "a",
      "b",
      "a#2",
      "a#3",
    ]);
  });
});
