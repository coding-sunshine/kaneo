import { describe, expect, it } from "vite-plus/test";
import { ownerSelection } from "./review-owner";

describe("ownerSelection", () => {
  it("clears the override when the original author is picked", () => {
    expect(ownerSelection("u1", "u1", true)).toBeNull();
  });

  it("stores another member", () => {
    expect(ownerSelection("u2", "u1", true)).toBe("u2");
  });

  it("stores anyone when the author maps to no member", () => {
    expect(ownerSelection("u2", null, true)).toBe("u2");
  });

  it("clears the override when the checked owner is unchecked", () => {
    expect(ownerSelection("u2", null, false)).toBeNull();
  });
});
