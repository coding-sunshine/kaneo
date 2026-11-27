import { describe, expect, it } from "vite-plus/test";
import { parseTokenBudget } from "./parse-token-budget";

describe("parseTokenBudget", () => {
  it("reads an empty field as no limit", () => {
    expect(parseTokenBudget("")).toBeNull();
    expect(parseTokenBudget("  ")).toBeNull();
  });

  it("keeps 0 as a real budget", () => {
    expect(parseTokenBudget("0")).toBe(0);
  });

  it("reads whole token counts", () => {
    expect(parseTokenBudget(" 25000 ")).toBe(25000);
  });

  it("rejects negative, fractional and non-numeric input", () => {
    expect(parseTokenBudget("-1")).toBeUndefined();
    expect(parseTokenBudget("1.5")).toBeUndefined();
    expect(parseTokenBudget("ten")).toBeUndefined();
  });
});
