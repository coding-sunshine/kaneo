import { describe, expect, it } from "vite-plus/test";
import { safeFileName } from "./safe-file-name";

describe("safeFileName", () => {
  it("keeps the title and replaces path characters", () => {
    expect(safeFileName("Q3/Q4: Plan", "md")).toBe("Q3-Q4- Plan.md");
    expect(safeFileName("Café", "pdf")).toBe("Café.pdf");
  });

  it("names an untitled file", () => {
    expect(safeFileName("  ", "md")).toBe("untitled.md");
  });
});
