import { describe, expect, it } from "vite-plus/test";
import { fileSlug } from "./file-slug";

describe("fileSlug", () => {
  it("keeps letters and digits and drops path characters", () => {
    expect(fileSlug("Café ../Plan: Q3/Q4")).toBe("cafe-plan-q3-q4");
  });

  it("falls back when nothing is left", () => {
    expect(fileSlug("漢字")).toBe("untitled");
    expect(fileSlug("", "doc")).toBe("doc");
  });
});
