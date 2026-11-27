import { describe, expect, it } from "vite-plus/test";
import { textHashOf, valueHash } from "./statement-hash";

describe("statement hashes", () => {
  it("keeps the text's hash in front of a further value's hash", () => {
    const further = valueHash("abc123", "2027-04-09");
    expect(further).toMatch(/^abc123#[0-9a-f]{16}$/);
    expect(textHashOf(further)).toBe("abc123");
    expect(textHashOf("abc123")).toBe("abc123");
  });

  it("gives two values of one text two hashes", () => {
    expect(valueHash("abc123", "2027-04-09")).not.toBe(
      valueHash("abc123", "2027-03-05"),
    );
  });
});
